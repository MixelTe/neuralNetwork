import * as Lib from "./littleLib.js";
import { TText } from "./littleLib.js";
import { Network } from "./network.js";
import { log, logError } from "./pageConsole.js";
import { preset_circles, preset_lines, preset_waves, preset_zones, presets_model } from "./presets.js";
import { draw, setVisualizerVisible } from "./visualizer.js";

const pixelSize = 16;
const pointSize = 7;
const movePoints = false;
const colors = {
	"red": localStorage.getItem("network_ariaMarker-pointsColors_1") || "#ff0000",
	"green": localStorage.getItem("network_ariaMarker-pointsColors_2") || "#00ff00",
	"blue": localStorage.getItem("network_ariaMarker-pointsColors_3") || "#0000ff",
}

export function start()
{
	const body = document.getElementById("network");
	const canvasDiv = Lib.Div();
	const canvas = document.createElement("canvas");
	const loader = Lib.get.div("loader");
	const scrollDown = Lib.get.div("scrollDown");
	const controlsDiv = Lib.Div(["padding", "container"]);
	const errorSpan = Lib.Span("text-error");
	const trainSpan = Lib.Span("text-normal");
	const speedSpan = Lib.Span();
	const pointsDiv = Lib.Div(["padding", "container", "container-outlined"]);
	const colorInput1 = Lib.Input("", "color");
	const colorInput2 = Lib.Input("", "color");
	const colorInput3 = Lib.Input("", "color");
	const saveDiv = Lib.Div(["padding", "container", "container-outlined"]);
	const slotPInp = Lib.Input("inp-short", "text");
	const presetDiv = Lib.Div(["padding", "container", "container-outlined"]);
	const presetSelect = createSelect([["lines", "линии"], ["waves", "волны"], ["zones", "зоны"], ["circles", "круги"]]);
	const settingsDiv = Lib.Div(["padding", "container"]);
	const funcSelect = createSelect([["sigmoid", "сигмоида"], ["relu", "relu"], ["tanh", "tanh"], ["linear", "линейная"]]);
	const colorSelect = createSelect([["1", "1"], ["2", "2"], ["3", "3"]]);
	const layersInp = Lib.Input([], "text");
	const learnRateInp = Lib.Input([], "number");
	const shiftingInp = Lib.Input([], "checkbox");
	const slotMInp = Lib.Input("inp-short", "text");
	const statsDiv = Lib.Div(["padding", "container"]);
	const lossSpan = Lib.Span("text-normal");
	const accuracySpan = Lib.Span("text-normal");
	const precisionSpan = Lib.Span("text-normal");
	const recallSpan = Lib.Span("text-normal");
	const f1Span = Lib.Span("text-normal");
	const changeLang = Lib.get.link("changeLang");
	canvasDiv.style.height = "100vh";
	canvasDiv.style.overflow = "hidden";
	body?.appendChild(canvasDiv);
	canvasDiv.appendChild(canvas);
	body?.appendChild(Lib.Div(["container", "desc"], [
		TText("LMB - add point; ", "ЛКМ - поставтить точку; "),
		TText("shift - use color 2; ", "shift - испл. цвет 2; "),
		TText("alt - use color 3; ", "alt - испл. цвет 3; "),
		TText("RMB or Double tap - remove point; ", "ПКМ или Двойное нажатие - удалить точку; "),
		TText("space - start/stop", "пробел - старт/стоп"),
	]));
	body?.appendChild(controlsDiv);
	body?.appendChild(pointsDiv);
	body?.appendChild(saveDiv);
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
		Lib.setContent(startBtn, TText(running ? "Stop" : "Start", running ? "Стоп" : "Старт"))
		log(running ? "Start training" : "Stop training");
		train();
	}
	const startBtn = addButton("Start", controlsDiv, onStartBtn);
	window.addEventListener("keydown", e =>
	{
		if (e.code == "Space")
		{
			e.preventDefault();
			onStartBtn();
		}
		else if (e.code == "ArrowUp" && e.ctrlKey)
		{
			changeInpLr(2);
		}
		else if (e.code == "ArrowDown" && e.ctrlKey)
		{
			changeInpLr(0.5);
		}
	})
	window.addEventListener("scroll", e =>
	{
		if (window.scrollY > 300)
		{
			const p = scrollDown.parentElement;
			if (p) p.removeChild(scrollDown);
		}
	})
	addButton(TText("Step", "Шаг"), controlsDiv, () =>
	{
		log("Train one epoch");
		trainOne();
		drawAll();
	});
	addButton(TText("Hide points", "Скрыть точки"), controlsDiv, btn =>
	{
		showPoints = !showPoints;
		Lib.setContent(btn, TText(showPoints ? "Hide points" : "Show points", showPoints ? "Скрыть точки" : "Показать точки"))
		redrawPoints();
	});
	addButton(TText("Delete all points", "Удалить все точки"), controlsDiv, () =>
	{
		log("Points cleared");
		points = [];
		activePoint = undefined;
		drawAll();
	});
	addButton(TText("Reset model", "Сбросить модель"), controlsDiv, () =>
	{
		log("Model reseted");
		network.createNetwork(layers, shiftingInp.checked);
		drawAll();
	});
	controlsDiv.appendChild(errorSpan);
	controlsDiv.appendChild(trainSpan);
	controlsDiv.appendChild(speedSpan);

	colorInput1.value = colors.red;
	colorInput2.value = colors.green;
	colorInput3.value = colors.blue;
	colorInput1.addEventListener("input", () => { colors.red = colorInput1.value; saveColors(); });
	colorInput2.addEventListener("input", () => { colors.green = colorInput2.value; saveColors(); });
	colorInput3.addEventListener("input", () => { colors.blue = colorInput3.value; saveColors(); });
	pointsDiv.appendChild(Lib.Span("container-outlined-lbl", [TText("Points", "Точки")]));
	pointsDiv.appendChild(Lib.Span("container", [
		TText("Color 1:", "Цвет 1:"),
		colorInput1,
	]));
	pointsDiv.appendChild(Lib.Span("container", [
		TText("Color 2:", "Цвет 2:"),
		colorInput2,
	]));
	pointsDiv.appendChild(Lib.Span("container", [
		TText("Color 3:", "Цвет 3:"),
		colorInput3,
	]));
	addButton(TText("Reset", "Сбросить"), pointsDiv, () =>
	{
		colors.red = "#ff0000";
		colors.green = "#00ff00";
		colors.blue = "#0000ff";
		colorInput1.value = colors.red;
		colorInput2.value = colors.green;
		colorInput3.value = colors.blue;
		saveColors();
		drawAll();
	});
	function saveColors()
	{
		localStorage.setItem("network_ariaMarker-pointsColors_1", colors.red);
		localStorage.setItem("network_ariaMarker-pointsColors_2", colors.green);
		localStorage.setItem("network_ariaMarker-pointsColors_3", colors.blue);
	}
	pointsDiv.appendChild(Lib.Span("container", [
		TText("Color of new:", "Цвет новых:"),
		colorSelect,
		TText("(if no keyboard)", "(если нет клавиатуры)"),
	]));

	saveDiv.appendChild(Lib.Span("container-outlined-lbl", [TText("Save values", "Сохранить значения")]));
	const savePointsDiv = Lib.Div("container");
	saveDiv.appendChild(savePointsDiv);
	savePointsDiv.appendChild(Lib.Span([], [TText("Points: ", "Точки: ")]));
	addButton(TText("Load", "Загрузить"), savePointsDiv, () =>
	{
		const v = localStorage.getItem("network_ariaMarker-savedPoints");
		if (!v) return log("No model data to load");
		try
		{
			const slot = slotPInp.value;
			const savedPoints = JSON.parse(v);
			if (!savedPoints[slot])
				return logError(`Points slot [${slot}] is empty`);

			points = savedPoints[slot] || [];
			activePoint = points[0];
			log(`Points data loaded from slot [${slot}]!`);
			redrawPoints();
		}
		catch (e)
		{
			logError(e);
		}
	});
	addButton(TText("Save", "Сохранить"), savePointsDiv, () =>
	{
		const v = localStorage.getItem("network_ariaMarker-savedPoints");
		const savedPoints = JSON.parse(v || "{}");
		const slot = slotPInp.value;
		savedPoints[slot] = points;
		localStorage.setItem("network_ariaMarker-savedPoints", JSON.stringify(savedPoints));
		log(`Points data saved to slot [${slot}]!`);
	});
	savePointsDiv.appendChild(Lib.Span([], [TText("Slot: ", "Слот: ")]));
	savePointsDiv.appendChild(slotPInp);
	slotPInp.value = "0";

	saveDiv.appendChild(Lib.Span("hbr"));
	const saveModelDiv = Lib.Div("container");
	saveDiv.appendChild(saveModelDiv);
	saveModelDiv.appendChild(Lib.Span([], [TText("Model: ", "Модель: ")]));
	addButton(TText("Load", "Загрузить"), saveModelDiv, () =>
	{
		const v = localStorage.getItem("network_ariaMarker-savedModels");
		if (!v) return log("No model data to load");
		try
		{
			const slot = slotMInp.value;
			const savedModels = JSON.parse(v);
			if (!savedModels[slot])
				return logError(`Model slot [${slot}] is empty`);

			const data = savedModels[slot] as ModelSave;
			loadModel(data);
			log(`Model data loaded from slot [${slot}]!`);
			redrawPoints();
		}
		catch (e)
		{
			logError(e);
		}
	});
	addButton(TText("Save", "Сохранить"), saveModelDiv, () =>
	{
		const v = localStorage.getItem("network_ariaMarker-savedModels");
		const savedModels = JSON.parse(v || "{}");
		const slot = slotMInp.value;
		const data: ModelSave = {
			layers: layers.slice(1, -1),
			fn: network.Activator,
			sh: shiftingInp.checked,
			lr: network.learningCoefficient,
		};
		savedModels[slot] = data;
		localStorage.setItem("network_ariaMarker-savedModels", JSON.stringify(savedModels));
		log(`Model data saved to slot [${slot}]!`);
	});
	saveModelDiv.appendChild(Lib.Span([], [TText("Slot: ", "Слот: ")]));
	saveModelDiv.appendChild(slotMInp);
	slotMInp.value = "0";

	presetDiv.appendChild(Lib.Span("container-outlined-lbl", [TText("For lazy :)", "Для ленивых :)")]));
	presetDiv.appendChild(Lib.Span([], [TText("Presets: ", "Заготовки: ")]));
	presetDiv.appendChild(presetSelect);
	addButton(TText("Load points", "Загрузить точки"), presetDiv, () =>
	{
		switch (presetSelect.value)
		{
			case "lines": points = preset_lines as Point[]; break;
			case "waves": points = preset_waves as Point[]; break;
			case "zones": points = preset_zones as Point[]; break;
			case "circles": points = preset_circles as Point[]; break;
		}
		points = JSON.parse(JSON.stringify(points));
		activePoint = points[0];
		log(`Points preset [${presetSelect.value}] loaded!`);
		redrawPoints();
	});
	addButton(TText("Load suitable model", "Загрузить подходящую модель"), presetDiv, () =>
	{
		const preset = presets_model[presetSelect.value as keyof typeof presets_model];
		loadModel(JSON.parse(JSON.stringify(preset)));
		log(`Model preset [${presetSelect.value}] loaded!`);
		setVisualizerVisible(false);
		drawAll();
	});
	function loadModel(modeSave: ModelSave)
	{
		network.Activator = modeSave.fn as any;
		network.learningCoefficient = modeSave.lr;
		layers = [2, ...modeSave.layers, 3];
		network.createNetwork(layers, modeSave.sh);

		funcSelect.value = modeSave.fn;
		layersInp.value = modeSave.layers.join(" ");
		shiftingInp.checked = modeSave.sh;
		learnRateInp.value = `${modeSave.lr}`;

		trainCount = 0;
	}

	settingsDiv.appendChild(Lib.Span("container", [
		TText("Activation func: ", "Функция активации: "),
		funcSelect,
	]));
	settingsDiv.appendChild(Lib.Span("container", [
		TText("Layers: ", "Слои: "),
		layersInp,
	]));
	settingsDiv.appendChild(Lib.initEl("label", "lbl-chbx", [shiftingInp, Lib.Span([], [TText("Bias", "Смещение")])], undefined));
	settingsDiv.appendChild(Lib.Span("container", [
		TText("Learn rate: ", "Коэф. обучения: "),
		Lib.Span("inp-lr", [
			learnRateInp,
			Lib.Button([], "×2", () => changeInpLr(2)),
			Lib.Button([], "÷2", () => changeInpLr(0.5)),
		]),
		Lib.Span([], [], "(ctrl+up/down)"),
	]));
	function changeInpLr(m: number)
	{
		network.learningCoefficient = Math.min(network.learningCoefficient * m, 0.8);
		learnRateInp.value = `${network.learningCoefficient}`;
	}

	const lossLbl = Lib.Span([], [], "Loss: ")
	lossLbl.title = "Cross-Entropy Loss";
	statsDiv.appendChild(Lib.Span([], [
		lossLbl,
		lossSpan,
	]));
	statsDiv.appendChild(Lib.Span([], [
		Lib.Span([], [], "Accuracy: "),
		accuracySpan,
	]));
	statsDiv.appendChild(Lib.Span([], [
		Lib.Span([], [], "Precision: "),
		precisionSpan,
	]));
	statsDiv.appendChild(Lib.Span([], [
		Lib.Span([], [], "Recall: "),
		recallSpan,
	]));
	statsDiv.appendChild(Lib.Span([], [
		Lib.Span([], [], "F1: "),
		f1Span,
	]));

	funcSelect.addEventListener("change", () =>
	{
		network.Activator = funcSelect.value as any;
		network.createNetwork(layers, shiftingInp.checked);
		log(`Activation function changed to ${funcSelect.value}`);
		drawAll();
	});
	funcSelect.value = network.Activator;

	layersInp.addEventListener("change", () =>
	{
		const layersNew = layersInp.value.trim().split(" ").map(v => Math.abs(parseInt(v))).filter(v => !isNaN(v) && v > 0);
		layers = [2, ...layersNew, 3];
		layersInp.value = layers.slice(1, -1).join(" ");
		network.createNetwork(layers, shiftingInp.checked);
		trainCount = 0;
		if (layers.reduce((p, v) => p + v) > 32)
			setVisualizerVisible(false);
		log(`Layers changed to ${layersInp.value}`);
		drawAll();
	});
	shiftingInp.addEventListener("change", () =>
	{
		network.createNetwork(layers, shiftingInp.checked);
		trainCount = 0;
		log(shiftingInp.checked ? "Shifting enabled" : "Shifting disabled");
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
	visualizerDiv.prepend(Lib.Button([], TText("Save image", "Сохранить изображении"), async () =>
	{
		const fname = `NeuralNetwork-${funcSelect.value}-${layers.slice(1, -1).join("_")}${shiftingInp.checked ? "-sh" : ""}-lr_${learnRateInp.valueAsNumber}.png`
		Lib.canvas.saveAsPng(canvas, fname);
		log(`Canvas image saved as ${fname}`);
	}))
	visualizerDiv.prepend(Lib.Button([], TText("Draw high quality", "Отрисовка в высоком качестве"), async () =>
	{
		if (running) onStartBtn();
		log("Start high quality drawing")
		window.scrollTo(0, 0);
		showLoader();
		await Lib.wait(1);
		await drawAll(true);
		hideLoader();
		log("End high quality drawing")
	}))

	drawAll();

	let lastSelectTime = Date.now();
	canvas.addEventListener("click", e =>
	{
		const x = e.offsetX;
		const y = e.offsetY;
		for (let i = 0; i < points.length; i++)
		{
			const point = points[i];
			if (s(x - point.x * canvas.width) + s(y - point.y * canvas.height) <= s(pointSize * 2))
			{
				if (e.ctrlKey)
				{
					if (point.color == "red") point.color = "green";
					else if (point.color == "green") point.color = "blue";
					else if (point.color == "blue") point.color = "red";
				}
				else
				{
					const now = Date.now();
					if (activePoint == point && now - lastSelectTime < 200)
					{
						points.splice(i, 1);
						activePoint = points[0];
					}
					else
					{
						activePoint = point;
					}
					lastSelectTime = now;
					drawNetwork();
				}
				redrawPoints();
				return;
			}
		}
		let color = ["red", "green", "blue"][parseInt(colorSelect.value) - 1] as "red" | "blue" | "green";
		if (e.shiftKey) color = color == "green" ? "red" : "green";
		else if (e.altKey) color = color == "blue" ? "red" : "blue";
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
			if (s(x - point.x * canvas.width) + s(y - point.y * canvas.height) <= s(pointSize * 2))
			{
				points.splice(i, 1);
				if (point == activePoint) activePoint = points[0];
				redrawPoints();
				return;
			}
		}
	});

	async function drawAll(hq = false)
	{
		clearCanvas();
		await drawBack(hq);
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
		if (showPoints) drawPoints();
	}
	function drawPoints()
	{
		for (let i = 0; i < points.length; i++)
		{
			const point = points[i];
			ctx.fillStyle = colors[point.color];
			ctx.strokeStyle = point == activePoint ? "lime" : "black";
			ctx.beginPath();
			ctx.arc(point.x * canvas.width, point.y * canvas.height, pointSize, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(point.x * canvas.width, point.y * canvas.height, pointSize, 0, Math.PI * 2);
			ctx.stroke();
			if (point == activePoint)
			{
				ctx.strokeStyle = "blue";
				ctx.beginPath();
				ctx.arc(point.x * canvas.width, point.y * canvas.height, pointSize + 1, 0, Math.PI * 2);
				ctx.stroke();
			}
		}
	}
	async function drawBack(hq = false)
	{
		const ps = hq ? 1 : pixelSize;
		for (let y = 0; y < canvas.height; y += ps)
		{
			// const _y = y % 2 ? y : canvas.height - y - ps;
			for (let x = 0; x < canvas.width; x += ps)
			{
				const res = network.calculate(normalize(x, y));
				const r = minmax(0, res[0] * 255, 255);
				const g = minmax(0, res[1] * 255, 255);
				const b = minmax(0, res[2] * 255, 255);
				ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
				ctx.fillRect(x, y, ps, ps);
			}
			if (hq && y % 5 == 0)
			{
				setLoader((y + 1) / canvas.height);
				await Lib.wait(1);
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
			// const r1 = point.color == "red" ? 1 : 0;
			// const r2 = point.color == "green" ? 1 : 0;
			// const r3 = point.color == "blue" ? 1 : 0;
			const c = colors[point.color];
			const r1 = parseInt(c.slice(1, 3), 16) / 255;
			const r2 = parseInt(c.slice(3, 5), 16) / 255;
			const r3 = parseInt(c.slice(5, 7), 16) / 255;
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

		const loss = -last_pred.reduce((V, P, I) => V + softmax(P).reduce((v, p, i) => v + last_answ[I][i] * Math.log(p), 0), 0) / last_pred.length;
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
		const exp = preds.map(v => Math.exp(v * 10));
		const d = sum(exp);
		return exp.map(v => v / d);
	};
	function sum(nums: (number | boolean)[])
	{
		return nums.reduce<number>((c, v) => c + (typeof v == "boolean" ? (v ? 1 : 0) : v), 0);
	}
	function minmax(min: number, v: number, max: number)
	{
		return Math.min(Math.max(min, v), max);
	}
	function addButton(text: string | HTMLElement, parent: HTMLElement, onclick: (btn: HTMLButtonElement) => void)
	{
		const button = document.createElement("button");
		if (typeof text == "string")
			button.innerText = text;
		else
			button.appendChild(text);
		button.addEventListener("click", onclick.bind(button, button));
		parent.appendChild(button);
		return button;
	}
	function createSelect(options: string[][])
	{
		const select = document.createElement("select");
		for (const option of options)
		{
			const el = document.createElement("option");
			el.value = option[0];
			el.appendChild(TText(option[0], option[1]))
			select.appendChild(el);
		}
		return select
	}
	function showLoader()
	{
		loader.classList.add("loader-visible");
	}
	function hideLoader()
	{
		loader.classList.remove("loader-visible");
	}
	function setLoader(v: number)
	{
		loader.style.setProperty("--v", `${v}`);
	}

	function updateLang()
	{
		Lib.setLang(!Lib.langEn);
		changeLang.innerText = Lib.langEn ? "En" : "Ru";
		changeLang.href = Lib.langEn ? "?lang=ru" : "?lang=en";
		const url = new URL(location.href);
		if (Lib.langEn) url.searchParams.delete("lang");
		else url.searchParams.set("lang", "ru");
		history.replaceState(undefined, "", url);
	}
	Lib.setLang(new URL(location.href).searchParams.get("lang") == "ru");
	updateLang();
	changeLang.addEventListener("click", e =>
	{
		e.preventDefault();
		updateLang();
	})

	points = JSON.parse(JSON.stringify(preset_lines));
	log(`Points preset [${presetSelect.value}] loaded!`);
	loadModel(JSON.parse(JSON.stringify(presets_model.lines)));
	log(`Model preset [${presetSelect.value}] loaded!`);
	onStartBtn();
}

interface Point
{
	x: number,
	y: number,
	color: "red" | "blue" | "green",
	d: number,
}
interface ModelSave
{
	layers: number[],
	fn: string,
	sh: boolean,
	lr: number,
}
