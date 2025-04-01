# Synx FRP

A functional reactive programming library for JavaScript built on pure FP principles.

## Overview

Synx FRP is a lightweight library that brings functional programming concepts like monads, functors, and applicatives to JavaScript UI development. Unlike other reactive libraries, Synx FRP maintains mathematical purity while providing practical utilities for modern web applications.

## Core Concepts

### Event

`Event` is the fundamental building block of Synx FRP, representing a value that can change over time.

```javascript
import { createEvent, fromDOMEvent } from "@synx/frp";

// Create a basic event
const countEvent = createEvent(0);

// Listen to DOM events
const buttonEvent = fromDOMEvent(document.getElementById("button"), "click");

// Subscribe to events
countEvent.subscribe((value) => console.log(`Count: ${value}`));

// Emit a new value
countEvent.emit(1);
```

Events implement the functor interface, allowing transformations via `map`:

```javascript
const doubled = countEvent.map((count) => count * 2);
```

### Reactive

Reactive values allow for declarative data transformations and dependencies:

```javascript
const firstName = createEvent("John");
const lastName = createEvent("Doe");

// Derive a new reactive value
const fullName = firstName.combine(
  lastName,
  (first, last) => `${first} ${last}`,
);

fullName.subscribe((name) => console.log(`Name: ${name}`));
```

Combine multiple reactive values using monadic operations:

```javascript
const selectEvent = buttonEvent
  .map(() => getRandomId())
  .flatMap((id) => fromDOMEvent(document.getElementById(id), "click"))
  .accumulate(0, (count, _) => count + 1);
```

### Future (WIP)

`Future` represents asynchronous computations with functional handling:

```javascript
import { Future } from "purifyjs";

// Create a future from a promise
const dataFuture = Future.fromPromise(fetch("/api/data").then((r) => r.json()));

// Transform the result
const processedFuture = dataFuture.map((data) => processData(data));

// Handle success and failure
processedFuture.fork(
  (error) => console.error("Failed to load data", error),
  (result) => console.log("Data processed", result),
);
```

Compose asynchronous operations:

```javascript
const userDataFuture = Future.fromPromise(fetch("/api/user"))
  .map((r) => r.json())
  .flatMap((user) => Future.fromPromise(fetch(`/api/data/${user.id}`)))
  .map((r) => r.json());
```

````

## Why Synx FRP?

- **Pure Functional**: Based on algebraic principles from category theory
- **Lightweight**: Minimal core with tree-shakable modules
- **Powerful**: Combines event handling, state management, and rendering
- **Predictable**: Functional purity leads to fewer side effects
- **Composable**: Everything is designed to be combined and reused

## Installation

```bash
npm install @synx/frp
````

## Example Application

```javascript
import { createEvent, fromDOMEvent } from "@synx/frp";

function dynamicEventExample() {
  // Create the selector button event
  const selectorButton = document.getElementById("selector")!;
  const selectorEvent = fromDOMEvent(selectorButton, "click");

  // IDs of the potential target buttons
  const buttonIds = ["button-1", "button-2", "button-3"];

  // Create a reactive value that contains the currently selected button ID
  const selectedButtonIdEvent = selectorEvent.map(() => {
    // Select a random button ID
    const randomIndex = Math.floor(Math.random() * buttonIds.length);
    const selectedId = buttonIds[randomIndex];
    console.log(`Selected button: ${selectedId}`);
    return selectedId;
  });

  // Create a reactive value that holds the selected button element
  const selectedButtonEvent = selectedButtonIdEvent.map((id) => {
    const element = document.getElementById(id)!;
    // Highlight the selected button
    buttonIds.forEach((btnId) => {
      const btn = document.getElementById(btnId)!;
      btn.classList.remove("selected");
    });
    element.classList.add("selected");
    return element;
  });

  // Use flatMap to create a dynamic event source
  const dynamicClickEvent = selectedButtonEvent.flatMap((button) => {
    console.log(`Creating click event for ${button.id}`);
    return fromDOMEvent(button, "click");
  });

  // Count the clicks on the dynamically selected button
  const clickCountReactive = dynamicClickEvent.accumulate(
    0,
    (count, _) => count + 1
  );

  // Display the click count
  clickCountReactive.subscribe((count) => {
    console.log(`Click count: ${count}`);
    document.getElementById("click-count")!.textContent = count.toString();
  });

  // Also display which button is currently selected
  selectedButtonIdEvent.subscribe((id) => {
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
```

## License

MIT
