import * as Lib from "./littleLib.js";
import { TText } from "./littleLib.js";
const canvas = Lib.get.canvas("visualizer");
const ctx = Lib.canvas.getContext2d(canvas);
const chbDiv = Lib.get.div("visualizer-controls");
const chb = Lib.Input([], "checkbox");
let lastNetwork = null;
chb.checked = true;
chb.addEventListener("change", () => {
    update();
});
chbDiv.appendChild(Lib.initEl("label", "lbl-chbx", [
    chb,
    TText("Visualizer", "Визуализатор"),
], undefined));
const nodeSize = 45;
// const spaceH = 140;
// const spaceV = 80;
const spaceH = nodeSize * 2.9;
const spaceV = nodeSize * 1.6;
const colors = {
    connection: "grey",
    outline: "black",
    node: "wheat",
    value: "black",
    error: "tomato",
    weight: "wheat",
    weightOutline: "black",
};
function update() {
    canvas.style.display = chb.checked ? "" : "none";
    if (chb.checked && lastNetwork) {
        draw(lastNetwork);
        lastNetwork = null;
    }
}
export function setVisualizerVisible(visible) {
    chb.checked = visible;
    update();
}
export function draw(network) {
    if (!chb.checked)
        return;
    lastNetwork = network;
    canvas.width = network.neurons.length * (nodeSize + spaceH);
    let maxNodes = 0;
    network.neurons.forEach(layer => maxNodes = Math.max(maxNodes, layer.length));
    canvas.height = maxNodes * (nodeSize + spaceV) + nodeSize;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${nodeSize / 5 * 2}px Arial`;
    ctx.strokeStyle = colors.connection;
    ctx.lineWidth = 3;
    for (let j = 0; j < network.connections.length; j++) {
        const cons = network.connections[j];
        for (let o = 0; o < cons.length; o++) {
            const nos = cons[o];
            for (let i = 0; i < nos.length; i++) {
                const [x1, y1] = calcXY(j, i, nos.length, maxNodes);
                const [x2, y2] = calcXY(j + 1, o, cons.length, maxNodes);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }
    }
    const fontSize = nodeSize / 5 * 2.5;
    ctx.font = `${fontSize}px Arial`;
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 1;
    for (let x = 0; x < network.neurons.length; x++) {
        const layer = network.neurons[x];
        for (let y = 0; y < layer.length; y++) {
            const node = layer[y];
            const [X, Y] = calcXY(x, y, layer.length, maxNodes);
            ctx.fillStyle = colors.node;
            ctx.beginPath();
            ctx.arc(X, Y, nodeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const offset = x == 0 ? 0 : fontSize / 2;
            ctx.fillStyle = colors.value;
            ctx.fillText(`${node.value}`.slice(0, 6 + (node.value < 0 ? 1 : 0)), X - fontSize * 1.5, Y + fontSize / 3 - offset);
            if (x != 0) {
                ctx.fillStyle = colors.error;
                ctx.fillText(`${node.error}`.slice(0, 6 + (node.error < 0 ? 1 : 0)), X - fontSize * 1.5, Y + fontSize / 3 + offset);
            }
            if (x == 0 && y < 2) {
                ctx.fillStyle = colors.node;
                ctx.fillText(y == 0 ? "X" : "Y", X + nodeSize / 2 - fontSize * 1.5, Y + nodeSize * 1.5);
            }
            if (x == network.neurons.length - 1) {
                ctx.fillStyle = colors.node;
                ctx.fillText(y == 0 ? "R" : y == 1 ? "G" : "B", X + nodeSize / 2 - fontSize * 1.3, Y + nodeSize * 1.5);
            }
        }
    }
    ctx.strokeStyle = colors.weightOutline;
    ctx.fillStyle = colors.weight;
    ctx.lineWidth = 0.5;
    for (let j = 0; j < network.connections.length; j++) {
        const cons = network.connections[j];
        for (let o = 0; o < cons.length; o++) {
            const nos = cons[o];
            for (let i = 0; i < nos.length; i++) {
                const ni = nos[i];
                const [x1, y1] = calcXY(j, i, nos.length, maxNodes);
                const [x2, y2] = calcXY(j + 1, o, cons.length, maxNodes);
                const d = Math.atan2(y1 - y2, x1 - x2);
                ctx.save();
                ctx.translate(x2, y2);
                ctx.rotate(d);
                ctx.scale(-1, -1);
                const text = `${ni}`.slice(0, 6 + (ni < 0 ? 1 : 0));
                const x = -fontSize * (text.length - 0.5 - (text.indexOf("-") >= 0 ? 0.5 : 0));
                const y = 0;
                ctx.fillText(text, x, y);
                ctx.strokeText(text, x, y);
                ctx.restore();
            }
        }
    }
}
function calcXY(x, y, nodes, maxNodes) {
    const X = x * (nodeSize + spaceH) + nodeSize;
    // const offset = (maxNodes - nodes) * (nodeSize + spaceV) / 2;
    // const Y = y * (nodeSize + spaceV) + nodeSize + offset;
    const spaceVl = (maxNodes * (nodeSize + spaceV) - nodes * nodeSize) / nodes;
    const Y = y * (nodeSize + spaceVl) + nodeSize + spaceVl / 2;
    return [X, Y];
}
