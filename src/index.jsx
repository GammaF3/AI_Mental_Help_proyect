//index.jsx
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { fetchGPTResponse } from "./services";

function Chat_App() {
    // Reactive signals
    const [ingredients, setIngredients] = createSignal("");
    const [recipe, setRecipe] = createSignal({
        preparationMethod: "",
        nutritionalInformation: ""
    });
    const [loading, setLoading] = createSignal(false);

    // Makes call to the API
    async function getRecipe() {
        setLoading(true);
        try {
            const response = await fetchGPTResponse(ingredients());
            setRecipe(response);
        } catch (error) {
            console.error("Failed to fetch recipe:", error);
            setRecipe({
                preparationMethod: "Error fetching recipe. Please try again.",
                nutritionalInformation: ""
            });
        } finally {
            setLoading(false);
        }
    }

    // JSX
    return (
        <div class="bg-white shadow-md rounded-lg p-8 m-auto max-w-lg">
            {/* Text area to catch the user input */}
            <textarea
                value={ingredients()}
                onChange={(ev) => setIngredients(ev.currentTarget.value)}
                placeholder="Enter ingredients..."
                class="w-full p-2 border border-gray-300 rounded mb-4"
            />

            {/* Button to submit the form */}
            <button
                onclick={getRecipe}
                disabled={loading() || !ingredients().trim()}
                class="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded"
            >
                {loading() ? "Loading..." : "Get Recipe"}
            </button>

            {/* Container where the GPT response will be rendered */}
            {!loading() && recipe().preparationMethod && (
                <>
                    <p class="bg-gray-100 p-4 mt-4 rounded">
                        <strong>Preparation:</strong> {recipe().preparationMethod}
                    </p>
                    <p class="bg-gray-100 p-4 mt-2 rounded">
                        <strong>Nutritional Info:</strong> {recipe().nutritionalInformation}
                    </p>
                </>
            )}
        </div>
    );
}

const root = document.getElementById("root");
render(() => <Chat_App />, root);