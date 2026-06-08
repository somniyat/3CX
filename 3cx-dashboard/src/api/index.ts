/**
 * Point d'entree API unique.
 * Toutes les pages importent depuis ici.
 */
export {
  getCallHistory,
  getActiveCalls,
  getRecordings,
  getRecordingDownloadUrl,
  downloadRecording,
  getRecordingAudioUrl,
  getTranscriptions,
  getTranscription,
  getSystemStatus,
  getExtensions,
  listUsers,
  getAccessAudit,

  type PaginatedList,
  type CallRecord,
  type ActiveCall,
  type Recording,
  type Extension,
  type Transcription,
  type TranscriptionSegment,
  type AppUser,
  type UserListResult,
  type AccessAuditResult,

  listDrivers,
  getDriverDetail,
  getDriverByPhone,
  createDriver,
  updateDriver,
  deleteDriverApi,
  getDriverDossier,
  getDriverCommunicationsByPhone,
  getDriverRecentComms,

  type Driver,
  type CreateDriverInput,
  type DriverDossier,
} from './client';
