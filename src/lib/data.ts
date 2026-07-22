
export type Rank = "Cel" | "TC" | "Maj" | "Cap" | "1º Ten" | "2º Ten" | "Asp" | "ST" | "1º Sgt" | "2º Sgt" | "3º Sgt" | "Cb" | "Sd";

export const RANKS: Rank[] = ["Cel", "TC", "Maj", "Cap", "1º Ten", "2º Ten", "Asp", "ST", "1º Sgt", "2º Sgt", "3º Sgt", "Cb", "Sd"];

export type UserRole = "ADMIN" | "VIEWER";
export const ROLES: UserRole[] = ["ADMIN", "VIEWER"];

export type OM = {
  id: string;
  code: string;
  abbreviation: string;
  name: string;
  responsibleUserId?: string;
};

export type Modality = {
  id: string;
  name: string;
  description?: string;
  isCompliance?: boolean;
  isFinancial?: boolean;
  order?: number;
  requiresDiexPreq?: boolean;
  requiresPregao?: boolean;
  requiresSipeo?: boolean;
  requiresBeneficiary?: boolean;
};

export type CreditNoteShare = {
  omId: string;
  value: number;
  sharedAt: string; // ISO string
  sharedBy: string; // User ID
};

export type CreditNoteRecollection = {
  value: number;
  recollectedAt: string; // ISO string
  recollectedBy: string; // User ID
  observation: string;
}

export type CreditNote = {
  id: string;
  ncNumber: string;
  emissionDate: string;
  limitDate: string;
  uasg: string;
  esf: string;
  ptres: string;
  fonte: string;
  nd: string;
  ugr: string;
  pi: string;
  totalValue: number;
  balance: number;
  shares: CreditNoteShare[];
  recollections?: CreditNoteRecollection[];
  observation?: string;
  createdAt: any; // Can be a server timestamp
};

export type ProtocolStatus = "Em Análise" | "Correção" | "Deferido" | "Restituído" | "Empenhado" | "Anulado";
export type ProtocolType = "Empenho" | "Reforço";

export type ProtocolObservation = {
    text: string;
    createdAt: any; // Can be a server timestamp or ISO string
    userId: string; // User ID
}

export type ProtocolCreditSource = {
    creditNoteId: string;
    ncNumber: string; // Snapshot of the NC number for historical visual consultation
    value: number;
}

export type Commitment = {
    neNumber: string;
    neDate: string; // ISO string
    value: number;
    observation?: string;
    createdAt: string; // ISO string
    createdBy: string; // User ID
}

export type Protocol = {
    id: string;
    controlCode: string;
    entryDate: string; // ISO string
    omId: string;
    omComplement?: string;
    diexNumber?: string;
    pReqNumber?: string;
    sipeoMapNumber?: string;
    beneficiaryName?: string;
    type: ProtocolType;
    modalityId: string;
    pregaoNumber?: string;
    creditSources: ProtocolCreditSource[];
    originalProtocolId?: string; // Link to the original protocol if this is a 'Reforço'
    value: number;
    observations: ProtocolObservation[];
    status: ProtocolStatus;
    createdAt: any; // Can be a server timestamp or ISO string
    updatedAt?: any; // Can be a server timestamp or ISO string
    userId: string; // User who created it (UID)
    commitments?: Commitment[]; // Array of commitments
};

export type CancellationLog = {
    id: string;
    omId: string;
    uasg: string;
    diexNumber: string;
    neNumber: string;
    value: number;
    observation: string;
    createdAt: string; // ISO String
    createdBy: string; // User ID
}

export type UserProfile = {
  id: string; // UID
  email: string;
  username: string; // e.g., 1ten.araujo
  warName: string;
  rank: Rank;
  omId: string;
  phoneNumber?: string;
  role: UserRole;
};

export type ReportType = 'COMPLIANCE' | 'FINANCIAL';

export type ComplianceReport = {
    id: string;
    controlNumber: string;
    year: number;
    sequence: number;
    generatedAt: string; // ISO String
    generatedBy: string; // User ID
    protocolIds: string[]; // List of protocol IDs included in the report
    commitmentNumbers?: string[]; // Optional: Specific NEs included in the report
    uasg: string; // UASG of the report
    type: ReportType;
}

export type AppSettings = {
    id: 'global'; // Singleton document
    ncAlertDays: {
        warning: number;
        critical: number;
    }
}
