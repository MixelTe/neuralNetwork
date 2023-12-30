import * as Lib from "./littleLib.js";
import { Network } from "./network.js";
import { log, logError } from "./pageConsole.js";
import { preset_circles, preset_lines, preset_waves, preset_zones, presets_model } from "./presets.js";
import { draw, setVisualizerVisible } from "./visualizer.js";

const pixelSize = 16;
const pointSize = 7;
const movePoints = false;

export function start()
{
	const body = document.getElementById("network");
	const canvasDiv = Lib.Div();
	const canvas = document.createElement("canvas");
	const controlsDiv = Lib.Div(["padding", "container"]);
	const errorSpan = Lib.Span("text-error");
	const trainSpan = Lib.Span("text-normal");
	const speedSpan = Lib.Span();
	const pointsDiv = Lib.Div(["padding", "container"]);
	const slotInp = Lib.Input("inp-short", "text");
	const presetDiv = Lib.Div(["padding", "container", "container-outlined"]);
	const presetSelect = createSelect(["lines", "waves", "zones", "circles"]);
	const settingsDiv = Lib.Div(["padding", "container"]);
	const funcSelect = createSelect(["sigmoid", "relu", "tanh", "linear"]);
	const layersInp = Lib.Input([], "text");
	const learnRateInp = Lib.Input([], "number");
	const shiftingInp = Lib.Input([], "checkbox");
	const statsDiv = Lib.Div(["padding", "container"]);
	const lossSpan = Lib.Span("text-normal");
	const accuracySpan = Lib.Span("text-normal");
	const precisionSpan = Lib.Span("text-normal");
	const recallSpan = Lib.Span("text-normal");
	const f1Span = Lib.Span("text-normal");
	canvasDiv.style.height = "100vh";
	canvasDiv.style.overflow = "hidden";
	body?.appendChild(canvasDiv);
	canvasDiv.appendChild(canvas);
	body?.appendChild(Lib.Div("desc", [], "LMB - add point, shift - green point, alt - blue point; RMB - remove point; shift+space = start/stop"));
	body?.appendChild(controlsDiv);
	body?.appendChild(pointsDiv);
	body?.appendChild(settingsDiv);
	body?.appendChild(statsDiv);
	body?.appendChild(presetDiv);

	let trainCount = 0;
	let trainCountPast = 0;
	const ctx = Lib.canvas.getContext2d(canvas, true);
	let points: Point[] = [];
	let activePoint: Point | undefined = undefined;
	let img: ImageData | null = null;
	let running = false;
	let showPoints = true;
	let layers = [2, 5, 3, 3];
	let last_pred: number[][] = [];
	let last_answ: number[][] = [];

	const network = new Network();
	network.createNetwork(layers);
	draw(network);

	function onStartBtn()
	{
		running = !running;
		startBtn.innerText = running ? "Stop" : "Start";
		train();
	}
	const startBtn = addButton("Start", controlsDiv, onStartBtn);
	window.addEventListener("keypress", e =>
	{
		if (e.code == "Space" && e.shiftKey)
		{
			e.preventDefault();
			onStartBtn();
		}
	})
	addButton("Step", controlsDiv, () =>
	{
		trainOne();
		drawAll();
	});
	addButton("Hide points", controlsDiv, btn =>
	{
		showPoints = !showPoints;
		btn.innerText = showPoints ? "Hide points" : "Show points";
		drawAll();
	});
	addButton("Clear points", controlsDiv, () =>
	{
		points = [];
		activePoint = undefined;
		drawAll();
	});
	addButton("Reset model", controlsDiv, () =>
	{
		network.createNetwork(layers, shiftingInp.checked);
		drawAll();
	});
	controlsDiv.appendChild(errorSpan);
	controlsDiv.appendChild(trainSpan);
	controlsDiv.appendChild(speedSpan);

	pointsDiv.appendChild(Lib.Span([], [], "Points: "));
	addButton("Load", pointsDiv, () =>
	{
		const v = localStorage.getItem("network_ariaMarker-savedPoints");
		if (!v) return log("No data to load");
		try
		{
			const slot = slotInp.value;
			const savedPoints = JSON.parse(v);
			if (!savedPoints[slot])
			{
				logError(`Slot [${slot}] is empty`);
				return;
			}

			points = savedPoints[slot] || [];
			activePoint = points[0];
			log("Points data loaded!");
			redrawPoints();
		}
		catch (e)
		{
			logError(e);
		}
	});
	addButton("Save", pointsDiv, () =>
	{
		const v = localStorage.getItem("network_ariaMarker-savedPoints");
		const savedPoints = JSON.parse(v || "{}");
		const slot = slotInp.value;
		savedPoints[slot] = points;
		localStorage.setItem("network_ariaMarker-savedPoints", JSON.stringify(savedPoints));
		log(`Points data saved to slot [${slot}]!`);
	});
	pointsDiv.appendChild(Lib.Span([], [], "Slot: "));
	pointsDiv.appendChild(slotInp);
	slotInp.value = "0";

	// pointsDiv.appendChild(Lib.Span("hbr"));
	presetDiv.appendChild(Lib.Span("container-outlined-lbl", [], "For lazy :)"));
	presetDiv.appendChild(Lib.Span([], [], "Presets: "));
	presetDiv.appendChild(presetSelect);
	addButton("Load points", presetDiv, () =>
	{
		switch (presetSelect.value)
		{
			case "lines": points = preset_lines as Point[]; break;
			case "waves": points = preset_waves as Point[]; break;
			case "zones": points = preset_zones as Point[]; break;
			case "circles": points = preset_circles as Point[]; break;
		}
		activePoint = points[0];
		log(`Points preset [${presetSelect.value}] loaded!`);
		redrawPoints();
	});
	addButton("Load suitable model", presetDiv, () =>
	{
		const preset = presets_model[presetSelect.value as keyof typeof presets_model];
		network.Activator = preset.fn as any;
		network.learningCoefficient = preset.lr;
		layers = [2, ...preset.layers, 3];
		network.createNetwork(layers, preset.sh);

		funcSelect.value = preset.fn;
		layersInp.value = preset.layers.join(" ");
		shiftingInp.checked = preset.sh;
		learnRateInp.value = `${preset.lr}`;

		trainCount = 0;
		log(`Model preset [${presetSelect.value}] loaded!`);
		setVisualizerVisible(false);
		drawAll();
	});

	settingsDiv.appendChild(Lib.Span([], [], "Activation func: "));
	settingsDiv.appendChild(funcSelect);
	settingsDiv.appendChild(Lib.Span([], [], "Layers: "));
	settingsDiv.appendChild(layersInp);
	settingsDiv.appendChild(Lib.initEl("label", "lbl-chbx", [shiftingInp, Lib.Span([], [], "Shifting")], undefined));
	settingsDiv.appendChild(Lib.Span([], [], "Learn rate: "));
	settingsDiv.appendChild(Lib.Span("inp-lr", [
		learnRateInp,
		Lib.Button([], "×2", () => changeInpLr(2)),
		Lib.Button([], "÷2", () => changeInpLr(0.5)),
	]));
	function changeInpLr(m: number)
	{
		network.learningCoefficient = Math.min(network.learningCoefficient * m, 0.8);
		learnRateInp.value = `${network.learningCoefficient}`;
	}

	{
		const lossLbl = Lib.Span([], [], "Loss: ")
		lossLbl.title = "Cross-Entropy Loss";
		statsDiv.appendChild(lossLbl);
	}
	statsDiv.appendChild(lossSpan);
	statsDiv.appendChild(Lib.Span([], [], "Accuracy: "));
	statsDiv.appendChild(accuracySpan);
	statsDiv.appendChild(Lib.Span([], [], "Precision: "));
	statsDiv.appendChild(precisionSpan);
	statsDiv.appendChild(Lib.Span([], [], "Recall: "));
	statsDiv.appendChild(recallSpan);
	statsDiv.appendChild(Lib.Span([], [], "F1: "));
	statsDiv.appendChild(f1Span);

	funcSelect.addEventListener("change", () =>
	{
		network.Activator = funcSelect.value as any;
		network.createNetwork(layers, shiftingInp.checked);
		drawAll();
	})

	layersInp.addEventListener("change", () =>
	{
		const layersNew = layersInp.value.trim().split(" ").map(v => Math.abs(parseInt(v))).filter(v => !isNaN(v) && v > 0);
		layers = [2, ...layersNew, 3];
		layersInp.value = layers.slice(1, -1).join(" ");
		network.createNetwork(layers, shiftingInp.checked);
		trainCount = 0;
		if (layers.reduce((p, v) => p + v) > 32)
			setVisualizerVisible(false);
		drawAll();
	});
	shiftingInp.addEventListener("change", () =>
	{
		network.createNetwork(layers, shiftingInp.checked);
		trainCount = 0;
		drawAll();
	});

	layersInp.value = "5 3";
	shiftingInp.checked = true;
	learnRateInp.min = "0";
	learnRateInp.max = "1";
	learnRateInp.step = "0.01";
	learnRateInp.value = `${network.learningCoefficient}`;
	learnRateInp.addEventListener("input", () => network.learningCoefficient = learnRateInp.valueAsNumber);

	const visualizerDiv = Lib.get.div("visualizer-controls");
	visualizerDiv.prepend(Lib.Button([], "Draw high quality", () =>
	{
		window.scrollTo(0, 0);
		// async + loader
		drawAll(true);
	}))
	// model saving

	drawAll();

	canvas.addEventListener("click", e =>
	{
		const x = e.offsetX;
		const y = e.offsetY;
		for (let i = 0; i < points.length; i++)
		{
			const point = points[i];
			if (s(x - point.x * canvas.width) + s(y - point.y * canvas.height) <= s(pointSize))
			{
				if (e.ctrlKey)
				{
					if (point.color == "red") point.color = "green";
					else if (point.color == "green") point.color = "blue";
					else if (point.color == "blue") point.color = "red";
				}
				else
				{
					activePoint = point;
					drawNetwork();
				}
				redrawPoints();
				return;
			}
		}
		let color: "red" | "blue" | "green" = "red"
		if (e.shiftKey) color = "green";
		else if (e.altKey) color = "blue";
		points.push({ x: x / canvas.width, y: y / canvas.height, color, d: Math.random() * Math.PI * 2 });
		if (points.length == 1)
		{
			activePoint = points[0];
			drawNetwork();
		}
		redrawPoints();
	});
	canvas.addEventListener("contextmenu", e =>
	{
		e.preventDefault();
		const x = e.offsetX;
		const y = e.offsetY;
		for (let i = 0; i < points.length; i++)
		{
			const point = points[i];
			if (s(x - point.x * canvas.width) + s(y - point.y * canvas.height) <= s(pointSize))
			{
				points.splice(i, 1);
				if (point == activePoint) activePoint = points[0];
				redrawPoints();
				return;
			}
		}
	});

	function drawAll(hq = false)
	{
		clearCanvas();
		drawBack(hq);
		img = ctx.getImageData(0, 0, canvas.width, canvas.height);
		if (showPoints) drawPoints();
		drawNetwork()
	}
	function clearCanvas()
	{
		Lib.canvas.fitToParent.ClientWH(canvas);
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	function redrawPoints()
	{
		clearCanvas();
		if (img) ctx.putImageData(img, 0, 0);
		drawPoints();
	}
	function drawPoints()
	{
		for (let i = 0; i < points.length; i++)
		{
			const point = points[i];
			ctx.fillStyle = point.color;
			ctx.strokeStyle = point == activePoint ? "lime" : "black";
			ctx.beginPath();
			ctx.arc(point.x * canvas.width, point.y * canvas.height, pointSize, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(point.x * canvas.width, point.y * canvas.height, pointSize, 0, Math.PI * 2);
			ctx.stroke();
		}
	}
	function drawBack(hq = false)
	{
		const ps = hq ? 1 : pixelSize;
		for (let y = 0; y < canvas.height; y += ps)
		{
			for (let x = 0; x < canvas.width; x += ps)
			{
				const res = network.calculate(normalize(x, y));
				const r = minmax(0, res[0] * 255, 255);
				const g = minmax(0, res[1] * 255, 255);
				const b = minmax(0, res[2] * 255, 255);
				ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
				ctx.fillRect(x, y, ps, ps);
			}
		}
	}
	function drawNetwork()
	{
		if (activePoint)
		{
			network.calculate([activePoint.x, activePoint.y]);
			network.findError([activePoint.color == "red" ? 1 : 0, activePoint.color == "green" ? 1 : 0, activePoint.color == "blue" ? 1 : 0]);
		}
		draw(network);
	}

	let redraw = true;
	let time = 0;
	function train()
	{
		if (!running) return;
		const error = trainOne();
		if (redraw)
		{
			const t = Date.now();
			const dt = t - time;
			time = t;
			redraw = false;
			drawAll();
			updateStats();
			trainSpan.innerText = `${trainCount}`;
			errorSpan.innerText = error.toFixed(8);
			speedSpan.innerText = `${Math.floor((trainCount - trainCountPast) / dt * 1000)}e/s`;
			trainCountPast = trainCount;
			setTimeout(() => redraw = true, 100);
		}
		requestAnimationFrame(train);
	}
	function trainOne()
	{
		let error = 0;
		last_pred = [];
		last_answ = [];
		points.forEach(point =>
		{
			if (movePoints)
			{
				point.x += Math.cos(point.d) / 1000;
				point.y += Math.sin(point.d) / 1000;
				if (point.x > 1) point.d = -Math.PI - point.d;
				if (point.x < 0) point.d = Math.PI - point.d;
				if (point.y < 0 || point.y > 1) point.d = 0 - point.d;
				point.x = Math.max(0, Math.min(point.x, 1));
				point.y = Math.max(0, Math.min(point.y, 1));
			}
			const r1 = point.color == "red" ? 1 : 0;
			const r2 = point.color == "green" ? 1 : 0;
			const r3 = point.color == "blue" ? 1 : 0;
			try
			{
				const ans = [r1, r2, r3];
				const { e, r } = network.train([point.x, point.y], ans);
				last_pred.push(r);
				last_answ.push(ans);
				error += e * e;
			}
			catch (e)
			{
				logError(e);
				console.error(e);
			}
		});
		trainCount++;
		return error;
	}
	function updateStats()
	{
		if (last_answ.length == 0) return;
		const indexes = (len: number) => new Array(len).fill(0).map((_, i) => i);
		const indexOfMax = (nums: number[]) => nums.indexOf(Math.max(...nums));
		const sum = (nums: (number | boolean)[]) => nums.reduce<number>((c, v) => c + (typeof v == "boolean" ? (v ? 1 : 0) : v), 0);

		const loss = -last_pred.reduce((V, P, I) => V + softmax(P).reduce((v, p, i) => v + last_answ[I][i] * Math.log(p), 0), 0);
		lossSpan.innerText = loss.toFixed(3);

		const preds = last_pred.map(p => indexOfMax(p));
		const ans = last_answ.map(p => indexOfMax(p));

		const accuracy = preds.filter((v, i) => v == ans[i]).length / last_pred.length;
		accuracySpan.innerText = accuracy.toFixed(3);

		const classes = last_answ[0].length;
		const TP = indexes(classes).map(I => sum(ans.map((a, i) => a == I && preds[i] == I)));
		const TN = indexes(classes).map(I => sum(ans.map((a, i) => a != I && preds[i] != I)));
		const FP = indexes(classes).map(I => sum(ans.map((a, i) => a != I && preds[i] == I)));
		const FN = indexes(classes).map(I => sum(ans.map((a, i) => a == I && preds[i] != I)));

		const precision = indexes(classes).map(i => TP[i] == 0 ? 0 : (TP[i] / (TP[i] + FP[i])));
		const precisionMean = sum(precision) / precision.length;
		precisionSpan.innerText = precisionMean.toFixed(3);

		const recall = indexes(classes).map(i => TP[i] == 0 ? 0 : (TP[i] / (TP[i] + FN[i])));
		const recallMean = sum(recall) / recall.length;
		recallSpan.innerText = recallMean.toFixed(3);

		const f1 = indexes(classes).map(i => (precision[i] == 0 || recall[i] == 0) ? 0 : ((2 * precision[i] * recall[i]) / (precision[i] + recall[i])));
		const f1Mean = sum(f1) / f1.length;
		f1Span.innerText = f1Mean.toFixed(3);
	}
	function s(x: number)
	{
		return x * x;
	}
	function normalize(x: number, y: number)
	{
		return [x / canvas.width, y / canvas.height];
	}
	function softmax(preds: number[])
	{
		const d = sum(preds.map(v => Math.exp(v)));
		return preds.map(v => Math.exp(v) / d);
	};
	function sum(nums: (number | boolean)[])
	{
		return nums.reduce<number>((c, v) => c + (typeof v == "boolean" ? (v ? 1 : 0) : v), 0);
	}
	function minmax(min: number, v: number, max: number)
	{
		return Math.min(Math.max(min, v), max);
	}
	function addButton(text: string, parent: HTMLElement, onclick: (btn: HTMLButtonElement) => void)
	{
		const button = document.createElement("button");
		button.innerText = text;
		button.addEventListener("click", onclick.bind(button, button));
		parent.appendChild(button);
		return button;
	}
	function createSelect(options: string[])
	{
		const select = document.createElement("select");
		for (const option of options)
		{
			const el = document.createElement("option");
			el.value = option;
			el.innerText = option;
			select.appendChild(el);
		}
		return select
	}
}

interface Point
{
	x: number,
	y: number,
	color: "red" | "blue" | "green",
	d: number,
}