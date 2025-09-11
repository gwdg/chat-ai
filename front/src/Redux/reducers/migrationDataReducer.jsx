export const migrationDataReducer = (state = {}, action) => {
  switch (action.type) {
    case 'STORE_MIGRATION_DATA':
      return { ...state, ...action.payload };
    case 'CLEAR_MIGRATION_DATA':
      return {}; // reset back to empty object
    default:
      return state;
  }
};