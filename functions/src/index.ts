
/**
 * @fileOverview Cloud Functions para o sistema SisGEC.
 * 
 * - createuser: Cria um novo usuário no Firebase Auth e o perfil no Firestore.
 * - deleteOldCreditNotes: Rotina agendada para apagar NCs baseada na data de emissão (política de 2 meses).
 */

import { onCall, HttpsError } from "firebase/functions/v2/https";
import { onSchedule } from "firebase/functions/v2/scheduler";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Cloud Function (v2) para criar um novo usuário.
 * Normaliza o e-mail para minúsculas para evitar erros de credenciais.
 */
export const createuser = onCall({ cors: true }, async (request) => {
  logger.info("--- createuser: Iniciado ---", { email: request.data?.email });

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
  }

  const { email, rank, warName, omId, role, phoneNumber } = request.data;
  if (!email || !warName || !rank || !omId || !role) {
    throw new HttpsError('invalid-argument', 'Campos obrigatórios ausentes.');
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

    return { 
      result: `Usuário ${username} criado com sucesso.`, 
      uid: userRecord.uid 
    };

  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Este e-mail já está em uso.');
    }
    throw new HttpsError('internal', `Falha no servidor: ${error.message}`);
  }
});

/**
 * Rotina agendada para executar a cada 2 meses.
 * Apaga Notas de Crédito cuja data de emissão seja superior a 2 meses, a contar de 1 Jan 2026.
 */
export const deleteOldCreditNotes = onSchedule("0 0 1 */2 *", async (event) => {
  logger.info("--- deleteOldCreditNotes: Iniciando limpeza bimestral ---");

  const now = new Date();
  const policyStartDate = new Date('2026-01-01T00:00:00Z');

  // Só executa se estivermos após Jan/26
  if (now < policyStartDate) {
    logger.info("--- deleteOldCreditNotes: Política ainda não iniciada (Aguardando Jan/2026). ---");
    return;
  }

  // Data de corte: 2 meses atrás
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() - 2);
  const expirationISO = expirationDate.toISOString();

  const db = admin.firestore();
  const creditNotesRef = db.collection("creditNotes");

  try {
    // Busca NCs baseadas na data de emissão
    const snapshot = await creditNotesRef
      .where("emissionDate", "<", expirationISO)
      .get();

    const batch = db.batch();
    let count = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Verificamos se o ano é 2026 ou superior para segurança extra
      if (data.emissionDate && data.emissionDate >= policyStartDate.toISOString()) {
          batch.delete(doc.ref);
          count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      logger.info(`--- deleteOldCreditNotes: Sucesso! ${count} notas de crédito antigas removidas. ---`);
    } else {
      logger.info("--- deleteOldCreditNotes: Nenhuma nota antiga para remover. ---");
    }

  } catch (error: any) {
    logger.error("--- deleteOldCreditNotes: Erro ao apagar notas ---", error);
  }
});
