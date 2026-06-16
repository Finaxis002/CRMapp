import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  leads: [],
  loading: false,
  error: null,
  selectedLead: null,
  filters: {
    status: "",
    source: "",
    assignedTo: "",
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
  },
};

const leadsSlice = createSlice({
  name: "leads",
  initialState,
  reducers: {
    setLeads: (state, action) => {
      state.leads = action.payload;
    },
    addLead: (state, action) => {
      state.leads.push(action.payload);
    },
    updateLead: (state, action) => {
      const index = state.leads.findIndex(
        (lead) => lead._id === action.payload._id,
      );
      if (index !== -1) {
        state.leads[index] = action.payload;
      }
    },
    deleteLead: (state, action) => {
      state.leads = state.leads.filter((lead) => lead._id !== action.payload);
    },
    setSelectedLead: (state, action) => {
      state.selectedLead = action.payload;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
  },
});

export const {
  setLeads,
  addLead,
  updateLead,
  deleteLead,
  setSelectedLead,
  setFilters,
  setLoading,
  setError,
  setPagination,
} = leadsSlice.actions;
export default leadsSlice.reducer;
