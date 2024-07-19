const initialState = [
  // Initial arcana objects
  {
    icon: "",
    title: "",
    description: "",
    files: [],
  },
  {
    icon: "",
    title: "",
    description: "",
    files: [],
  },
  {
    icon: "",
    title: "",
    description: "",
    files: [],
  },
];

function arcanaReducer(state = initialState, action) {
  switch (action.type) {
    case "SET_ITEM":
      return state.map((item, index) =>
        index === action.payload.index
          ? { ...item, ...action.payload.data }
          : item
      );
    case "SET_ICON":
      return state.map((item, index) =>
        index === action.payload.index
          ? { ...item, icon: action.payload.icon }
          : item
      );
    case "SET_TITLE":
      return state.map((item, index) =>
        index === action.payload.index
          ? { ...item, title: action.payload.title }
          : item
      );
    case "SET_DESCRIPTION":
      return state.map((item, index) =>
        index === action.payload.index
          ? { ...item, description: action.payload.description }
          : item
      );
    case "SET_FILES":
      return state.map((item, index) =>
        index === action.payload.index
          ? { ...item, files: action.payload.files }
          : item
      );
    default:
      return state;
  }
}

export default arcanaReducer;
