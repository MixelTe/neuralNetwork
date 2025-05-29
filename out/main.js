import { start as NW_ariaMarker } from "./NW_ariaMarker.js";
import { log, logError } from "./pageConsole.js";
try {
    main();
}
catch (e) {
    logError(e);
    console.error(e);
}
function main() {
    log("Starting");
    NW_ariaMarker();
}
