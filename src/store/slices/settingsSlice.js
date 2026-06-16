import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { settingsService } from "../../services/settingsService";

export const fetchSettings = createAsyncThunk(
  "settings/fetchSettings",
  async (_, thunkAPI) => {
    try {
      const settings = await settingsService.getSettings();
      return settings;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

export const saveSettings = createAsyncThunk(
  "settings/saveSettings",
  async (payload, thunkAPI) => {
    try {
      const settings = await settingsService.updateSettings(payload);
      return settings;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    data: null,
    loading: false,
    saving: false,
    error: null,
  },
  reducers: {
    resetSettings: (state) => {
      state.data = null;
      state.loading = false;
      state.saving = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(saveSettings.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.saving = false;
        state.data = action.payload;
      })
      .addCase(saveSettings.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      });
  },
});

export const { resetSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
