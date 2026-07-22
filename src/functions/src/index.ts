
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Adiciona um "ouvinte mestre" de erros para capturar qualquer rejeição de promessa não tratada
process.on('unhandledRejection', (reason, promise) => {
  functions.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Garante que o app seja inicializado apenas uma vez.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Cloud Function para criar um novo usuário no Firebase Auth e o perfil correspondente no Firestore.
 */
export const createUser = functions.https.onCall(async (data, context) => {
  functions.logger.log("--- createUser: Invoked ---", { email: data?.email });

  if (!context.auth) {
    functions.logger.error("--- createUser: Error - Unauthenticated.");
    throw new functions.https.HttpsError('unauthenticated', 'Você precisa estar autenticado.');
  }

  const { email, rank, warName, omId, role, phoneNumber } = data;
  if (!email || !warName || !rank || !omId || !role) {
    functions.logger.error("--- createUser: Error - Missing required fields.");
    throw new functions.https.HttpsError('invalid-argument', 'Campos obrigatórios ausentes.');
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const password = "sisgec2026";
    const rankFormatted = rank.toLowerCase().replace(/[\d\sºª.]/g, '');
    const warNameFormatted = warName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
    const username = `${rankFormatted}.${warNameFormatted}`;

    const userRecord = await admin.auth().createUser({
      email: normalizedEmail,
      password: password,
      displayName: warName,
    });

    const userProfile = {
      id: userRecord.uid,
      email: normalizedEmail,
      rank,
      warName,
      omId,
      role,
      username,
      phoneNumber: phoneNumber || "",
    };

    await admin.firestore().collection('users').doc(userRecord.uid).set(userProfile);

    return { result: `Usuário ${username} criado com sucesso.`, uid: userRecord.uid };

  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'Este e-mail já está em uso.');
    }
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Rotina agendada para apagar NCs com mais de 2 meses.
 * Executa no dia 1 a cada dois meses.
 */
export const deleteOldCreditNotes = functions.pubsub.schedule("0 0 1 */2 *").onRun(async (context) => {
  functions.logger.log("--- deleteOldCreditNotes: Iniciando limpeza ---");

  const now = new Date();
  const policyStartDate = new Date('2026-01-01T00:00:00Z');

  if (now < policyStartDate) {
    functions.logger.log("--- deleteOldCreditNotes: Aguardando data marco (Jan/2026). ---");
    return;
  }

  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() - 2);

  const db = admin.firestore();
  const creditNotesRef = db.collection("creditNotes");

  try {
    // Busca NCs baseadas no createdAt
    const snapshot = await creditNotesRef
      .where("createdAt", "<", admin.firestore.Timestamp.fromDate(expirationDate))
      .get();

    const batch = db.batch();
    let count = 0;

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    if (count > 0) {
      await batch.commit();
      functions.logger.log(`--- deleteOldCreditNotes: Sucesso! ${count} notas removidas. ---`);
    } else {
      functions.logger.log("--- deleteOldCreditNotes: Nenhuma nota antiga para remover. ---");
    }

  } catch (error: any) {
    functions.logger.error("--- deleteOldCreditNotes: Erro ---", error);
  }
});
