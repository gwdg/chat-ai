import Layout from "../components/Layout"; // Importing the Layout component
import Prompt from "../components/Prompt"; // Importing the Prompt component

// Home component
function Home() {
  return (
    <Layout>
      {" "}
      <Prompt /> {/* Rendering the Prompt component */}
    </Layout>
  );
}

export default Home; // Exporting the Home component
