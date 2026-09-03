import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, MODELE, EFFORT, consommerQuota, enregistrerUsage } from "./client.js";
import { construireContexte, SYSTEME_ASSISTANT } from "./context.js";
import { queryAll, queryOne, query } from "../../lib/db.js";
import { notFound, badRequest } from "../../lib/errors.js";
import logger from "../../lib/logger.js";

const MAX_HISTORIQUE = 20;

/** Bloc systeme : partie stable mise en cache, puis contexte scolaire du jour. */
const blocsSysteme = (contexte) => [
  { type: "text", text: SYSTEME_ASSISTANT, cache_control: { type: "ephemeral" } },
  { type: "text", text: `Données scolaires de l'élève (à jour) :\n\n${contexte.texte}` },
];

// --------------------------------------------------------------- conversations

export const listerConversations = (userId) =>
  queryAll(
    `SELECT c.id, c.title AS titre, c.scope AS portee, c.updated_at AS "majLe",
            (SELECT count(*)::int FROM ai_messages m WHERE m.conversation_id = c.id) AS messages
     FROM ai_conversations c
     WHERE c.user_id = $1 AND NOT c.archived
     ORDER BY c.updated_at DESC LIMIT 50`,
    [userId],
  );

export const lireConversation = async (userId, id) => {
  const conversation = await queryOne(
    "SELECT id, title AS titre, scope AS portee, created_at FROM ai_conversations WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  if (!conversation) throw notFound("Conversation introuvable.");

  const messages = await queryAll(
    `SELECT id, role, content AS contenu, created_at AS "creeLe"
     FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at`,
    [id],
  );
  return { ...conversation, messages };
};

export const supprimerConversation = (userId, id) =>
  query("DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2", [id, userId]);

const assurerConversation = async (userId, conversationId, premierMessage) => {
  if (conversationId) {
    const existante = await queryOne(
      "SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2",
      [conversationId, userId],
    );
    if (!existante) throw notFound("Conversation introuvable.");
    return conversationId;
  }
  const titre = premierMessage.slice(0, 60).replace(/\s+/g, " ").trim() || "Nouvelle conversation";
  const creee = await queryOne(
    "INSERT INTO ai_conversations (user_id, title) VALUES ($1, $2) RETURNING id",
    [userId, titre],
  );
  return creee.id;
};

const historique = async (conversationId) => {
  const messages = await queryAll(
    `SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [conversationId, MAX_HISTORIQUE],
  );
  return messages.reverse().map((m) => ({ role: m.role, content: m.content }));
};

/**
 * Conversation en streaming (SSE).
 * `emit(événement, données)` est fourni par la route.
 */
export const discuter = async (user, { message, conversationId }, emit) => {
  await consommerQuota(user.id);

  const id = await assurerConversation(user.id, conversationId, message);
  const [contexte, precedents] = await Promise.all([construireContexte(user), historique(id)]);

  await query("INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'user', $2)", [id, message]);

  emit("debut", { conversationId: id });

  const client = getClient();
  const stream = client.messages.stream({
    model: MODELE,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: EFFORT },
    system: blocsSysteme(contexte),
    messages: [...precedents, { role: "user", content: message }],
  });

  let reponse = "";
  for await (const evenement of stream) {
    if (evenement.type === "content_block_delta" && evenement.delta.type === "text_delta") {
      reponse += evenement.delta.text;
      emit("delta", { texte: evenement.delta.text });
    }
  }

  const final = await stream.finalMessage();

  await query(
    `INSERT INTO ai_messages (conversation_id, role, content, model, input_tokens, output_tokens)
     VALUES ($1, 'assistant', $2, $3, $4, $5)`,
    [id, reponse, MODELE, final.usage?.input_tokens ?? 0, final.usage?.output_tokens ?? 0],
  );
  await query("UPDATE ai_conversations SET updated_at = now() WHERE id = $1", [id]);
  await enregistrerUsage(user.id, final.usage);

  emit("fin", {
    conversationId: id,
    usage: {
      entree: final.usage?.input_tokens ?? 0,
      sortie: final.usage?.output_tokens ?? 0,
      cacheLu: final.usage?.cache_read_input_tokens ?? 0,
    },
  });

  return { conversationId: id, reponse };
};

// ------------------------------------------------------- generations structurees

const FicheSchema = z.object({
  titre: z.string(),
  matiere: z.string(),
  resumeCourt: z.string(),
  notionsCles: z.array(z.object({ terme: z.string(), definition: z.string() })),
  pointsEssentiels: z.array(z.string()),
  formulesOuDates: z.array(z.string()),
  piegesFrequents: z.array(z.string()),
  methode: z.array(z.string()),
});

const QuizSchema = z.object({
  titre: z.string(),
  matiere: z.string(),
  questions: z.array(
    z.object({
      enonce: z.string(),
      propositions: z.array(z.string()),
      indexBonneReponse: z.number().int(),
      explication: z.string(),
    }),
  ),
});

const CartesSchema = z.object({
  cartes: z.array(z.object({ recto: z.string(), verso: z.string(), indice: z.string().nullable() })),
});

const BriefSchema = z.object({
  titre: z.string(),
  resume: z.string(),
  priorites: z.array(z.object({ intitule: z.string(), pourquoi: z.string(), duree: z.string() })),
  aNePasOublier: z.array(z.string()),
  encouragement: z.string(),
});

/** Appel structure : le modele est contraint a repondre selon un schema Zod. */
const genererStructure = async (user, { schema, consigne, contexteTexte, effort = EFFORT, maxTokens = 8000 }) => {
  await consommerQuota(user.id);
  const client = getClient();

  const reponse = await client.messages.parse({
    model: MODELE,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    output_config: { effort, format: zodOutputFormat(schema) },
    system: [
      { type: "text", text: SYSTEME_ASSISTANT, cache_control: { type: "ephemeral" } },
      { type: "text", text: contexteTexte },
    ],
    messages: [{ role: "user", content: consigne }],
  });

  await enregistrerUsage(user.id, reponse.usage);

  if (!reponse.parsed_output) {
    logger.warn({ stop: reponse.stop_reason }, "Génération structuree sans sortie exploitable");
    throw badRequest("Le modèle n'a pas pu produire un résultat exploitable. Réessayez en precisant la demande.");
  }
  return reponse.parsed_output;
};

const sauvegarderArtefact = (userId, { kind, titre, matiere, contenu, source }) =>
  queryOne(
    `INSERT INTO study_artifacts (user_id, kind, subject, title, content, source_ref)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, kind, title AS titre, subject AS matiere, content AS contenu, created_at AS "creeLe"`,
    [userId, kind, matiere ?? null, titre, JSON.stringify(contenu), source ?? null],
  );

/** Brief du jour : ce qui compte aujourd'hui, hierarchise. */
export const briefDuJour = async (user) => {
  const contexte = await construireContexte(user);
  const contenu = await genererStructure(user, {
    schema: BriefSchema,
    contexteTexte: `Données scolaires de l'élève :\n\n${contexte.texte}`,
    effort: "low",
    maxTokens: 3000,
    consigne:
      "Rédige le brief du jour de cet élève. Hierarchise ce qui doit être fait aujourd'hui en te basant strictement " +
      "sur ses devoirs, son emploi du temps et ses résultats. Trois priorités maximum, avec une durée réaliste pour " +
      "chacune. Reste factuel : ne mentionne que ce qui figure dans les données.",
  });

  const artefact = await sauvegarderArtefact(user.id, {
    kind: "brief",
    titre: contenu.titre,
    contenu,
    source: `brief:${new Date().toISOString().slice(0, 10)}`,
  });
  return { ...artefact, contexte: contexte.resume };
};

/** Fiche de revision sur un chapitre ou un devoir. */
export const genererFiche = async (user, { sujet, matiere, detail }) => {
  const contexte = await construireContexte(user);
  const contenu = await genererStructure(user, {
    schema: FicheSchema,
    contexteTexte: `Données scolaires de l'élève :\n\n${contexte.texte}`,
    consigne:
      `Rédige une fiche de révision sur : "${sujet}"${matière ? ` en ${matiere}` : ""}.\n` +
      (detail ? `Précisions de l'élève : ${detail}\n` : "") +
      "Adapte le niveau a sa classe. La fiche doit être autoportante : quelqu'un qui la lit doit pouvoir réviser " +
      "sans le cours. Sois précis et concis, pas de remplissage.",
  });

  return sauvegarderArtefact(user.id, {
    kind: "fiche",
    titre: contenu.titre,
    matiere: contenu.matiere ?? matiere,
    contenu,
    source: sujet,
  });
};

/** Quiz d'auto-evaluation a choix multiples. */
export const genererQuiz = async (user, { sujet, matiere, nbQuestions = 8 }) => {
  const contexte = await construireContexte(user);
  const contenu = await genererStructure(user, {
    schema: QuizSchema,
    contexteTexte: `Données scolaires de l'élève :\n\n${contexte.texte}`,
    consigne:
      `Crée un quiz de ${nbQuestions} questions a choix multiples sur : "${sujet}"${matière ? ` en ${matiere}` : ""}.\n` +
      "Chaque question a exactement 4 propositions, une seule correcte, et une explication courte de la bonne réponse. " +
      "Varie les niveaux de difficulté. Les distracteurs doivent correspondre a des erreurs réalistes.",
  });

  // Garde-fou : on valide que l'index de bonne reponse est coherent.
  contenu.questions = contenu.questions.filter(
    (q) => q.propositions.length >= 2 && q.indexBonneReponse >= 0 && q.indexBonneReponse < q.propositions.length,
  );
  if (!contenu.questions.length) throw badRequest("Le quiz généré etait invalide. Réessayez.");

  return sauvegarderArtefact(user.id, {
    kind: "quiz",
    titre: contenu.titre,
    matiere: contenu.matiere ?? matiere,
    contenu,
    source: sujet,
  });
};

/** Cartes de revision pretes a etre injectees dans un paquet SRS. */
export const genererCartes = async (user, { sujet, matiere, nombre = 12 }) => {
  const contexte = await construireContexte(user);
  const contenu = await genererStructure(user, {
    schema: CartesSchema,
    contexteTexte: `Données scolaires de l'élève :\n\n${contexte.texte}`,
    consigne:
      `Crée ${nombre} cartes de révision (recto/verso) sur : "${sujet}"${matière ? ` en ${matiere}` : ""}.\n` +
      "Une carte = une seule idee testable. Le recto est une question précisé ou un terme ; le verso une réponse " +
      "courte et mémorisable (2 phrases maximum). Ajoute un indice seulement quand il aide vraiment.",
  });

  return contenu.cartes
    .filter((c) => c.recto && c.verso)
    .map((c) => ({ recto: c.recto, verso: c.verso, indice: c.indice ?? undefined }));
};

export const listerArtefacts = (userId, kind) =>
  queryAll(
    `SELECT id, kind, title AS titre, subject AS matiere, content AS contenu, pinned AS epingle,
            created_at AS "creeLe"
     FROM study_artifacts
     WHERE user_id = $1 AND ($2::text IS NULL OR kind = $2)
     ORDER BY created_at DESC LIMIT 60`,
    [userId, kind ?? null],
  );

export const lireArtefact = async (userId, id) => {
  const artefact = await queryOne(
    `SELECT id, kind, title AS titre, subject AS matiere, content AS contenu, created_at AS "creeLe"
     FROM study_artifacts WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (!artefact) throw notFound("Document introuvable.");
  return artefact;
};

export const supprimerArtefact = (userId, id) =>
  query("DELETE FROM study_artifacts WHERE id = $1 AND user_id = $2", [id, userId]);
