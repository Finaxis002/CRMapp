import api from "./api";

export const googleSheetsService = {
  /**
   * Get all sheet connections for this org
   */
  getConnections: async () => {
    const res = await api.get("/google-sheets/connections");
    return res.data.data;
  },

  /**
   * Step 1: Register sheet — sends headers + sample data back
   */
  registerSheet: async ({ googleEmail, sheetId, sheetName, tabName, sheetUrl, accessToken }) => {
    const res = await api.post("/google-sheets/register", {
      googleEmail, sheetId, sheetName, tabName, sheetUrl, accessToken,
    });
    return res.data.data; // { syncId, fieldMappings, totalHeaders }
  },

  /**
   * Step 2: Save confirmed mapping + fixed values
   */
  saveMapping: async (syncId, fieldMappings, fixedValues = [], isEdit = false) => {
    const res = await api.put(`/google-sheets/${syncId}/mapping`, {
      fieldMappings, fixedValues, isEdit,
    });
    return res.data.data;
  },

  /**
   * Refresh access token for an existing sync
   */
  refreshToken: async (syncId, accessToken) => {
    const res = await api.put(`/google-sheets/${syncId}/token`, { accessToken });
    return res.data.data;
  },

  /**
   * Delete / disconnect a sheet sync
   */
  deleteConnection: async (syncId) => {
    const res = await api.delete(`/google-sheets/${syncId}`);
    return res.data.data;
  },

  /**
   * Poll sync status
   */
  getSyncStatus: async (syncId) => {
    const res = await api.get(`/google-sheets/${syncId}/status`);
    return res.data.data;
  },

  /**
   * Get sheet data (rows) for SheetDataViewer
   */
  getSheetData: async (syncId) => {
    const res = await api.get(`/google-sheets/${syncId}/data`);
    return res.data;
  },
};
