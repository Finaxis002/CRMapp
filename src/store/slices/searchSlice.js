import { createSlice } from '@reduxjs/toolkit';

const searchSlice = createSlice({
  name: 'search',
  initialState: {
    query: '',
  },
  reducers: {
    setGlobalSearch: (state, action) => {
      state.query = action.payload ?? '';
    },
    clearGlobalSearch: state => {
      state.query = '';
    },
  },
});

export const { setGlobalSearch, clearGlobalSearch } = searchSlice.actions;
export default searchSlice.reducer;
