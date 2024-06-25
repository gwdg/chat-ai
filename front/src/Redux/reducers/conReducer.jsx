import instructionsReducer, {
  SET_INSTRUCTIONS,
} from "./instructionsReducer.jsx";

// initialize the initial state using the instructionsReducer
let initialState = instructionsReducer(undefined, {});

function conReducer(
  state = [{ role: "system", content: initialState }],
  action
) {
  switch (action.type) {
    case "SET_CONVERSATION":
      return action.payload;

    case SET_INSTRUCTIONS:
      // create a new data with updated content value, not mutating the state directly
      const newData = state.map((item) =>
        item.role === "system"
          ? { ...item, content: instructionsReducer(item.content, action) }
          : item
      );
      return newData;

    default:
      return state;
  }
}

export default conReducer;
