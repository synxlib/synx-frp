import { Event } from "../../../src/event";
import { fromDOMEvent } from "../../../src/helpers";

function dynamicEventExample() {
    // Create the selector button event
    const selectorButton = document.getElementById("selector")!;
    const selectorEvent = fromDOMEvent(selectorButton, "click");

    // IDs of the potential target buttons
    const buttonIds = ["button-1", "button-2", "button-3"];

    // Create a reactive value that contains the currently selected button ID
    const selectedButtonIdReactive = selectorEvent
        .map(() => {
            // Select a random button ID
            const randomIndex = Math.floor(Math.random() * buttonIds.length);
            const selectedId = buttonIds[randomIndex];
            console.log(`Selected button: ${selectedId}`);
            return selectedId;
        })
        .stepper("button-1");

    // Create a reactive value that holds the selected button element
    const selectedButtonReactive = selectedButtonIdReactive.map((id) => {
        const element = document.getElementById(id)!;
        console.log("Selected button changed");
        // Highlight the selected buttonk
        buttonIds.forEach((btnId) => {
            const btn = document.getElementById(btnId)!;
            btn.classList.remove("selected");
        });
        element.classList.add("selected");
        return element;
    });

    const dynamicClickEvent = Event.switch(
        fromDOMEvent(selectedButtonReactive.get(), "click"),
        selectorEvent.map(() =>
            fromDOMEvent(selectedButtonReactive.get(), "click")
        )
    );

    // Count the clicks on the dynamically selected button
    const clickCountReactive = dynamicClickEvent.fold(
        0,
        (count, _) => count + 1
    );

    // Display the click count
    clickCountReactive.subscribe((count) => {
        console.log(`Click count: ${count}`);
        document.getElementById("click-count")!.textContent = count.toString();
    });

    // Also display which button is currently selected
    selectedButtonIdReactive.subscribe((id) => {
        document.getElementById("selected-button-id")!.textContent = id;
    });

    // Return a cleanup function for the entire system
    return () => {
        dynamicClickEvent.cleanup();
        console.log("All event listeners and subscriptions cleaned up");
    };
}

// Call the function to set up the example
const cleanup = dynamicEventExample();

// Optional: Set up cleanup on page unload
window.addEventListener("beforeunload", cleanup);

