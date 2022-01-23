import * as Lib from "./littleLib.js";
import { Network } from "./network.js";
import { log, logError } from "./pageConsole.js";
import { draw } from "./visualizer.js";

const pixelSize = 15;
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
	canvasDiv.style.height = "100vh";
	canvasDiv.style.overflow = "hidden";
	body?.appendChild(canvasDiv);
	canvasDiv.appendChild(canvas);
	body?.appendChild(controlsDiv);

	let trainCount = 0;
	let trainCountPast = 0;
	const ctx = Lib.canvas.getContext2d(canvas);
	let points: Point[] = [];
	let activePoint: Point | undefined = undefined;
	let img: ImageData | null = null;
	let running = false;
	let showPoints = true;

	const network = new Network();
	network.createNetwork([2, 5, 3, 3]);
	draw(network);

	addButton("start", controlsDiv, btn =>
	{
		running = !running;
		btn.innerText = running ? "Stop" : "Start";
		train();
	});
	addButton("train", controlsDiv, () =>
	{
		trainOne();
		drawAll();
	});
	addButton("savePoints", controlsDiv, () =>
	{
		localStorage.setItem("network_ariaMarker-points", JSON.stringify(points));
		log("Data saved!");
	});
	addButton("loadPoints", controlsDiv, () =>
	{
		const v = localStorage.getItem("network_ariaMarker-points");
		if (!v) return log("No data to load");
		try
		{
			const parsed = JSON.parse(v);
			points = parsed;
			activePoint = points[0];
			log("Data loaded!");
			redrawPoints();
		}
		catch (e)
		{
			logError(e);
		}
	});
	addButton("Hide Points", controlsDiv, btn =>
	{
		showPoints = !showPoints;
		btn.innerText = showPoints ? "Hide Points" : "Show Points";
	});
	controlsDiv.appendChild(errorSpan);
	controlsDiv.appendChild(trainSpan);
	controlsDiv.appendChild(speedSpan);

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

	function drawAll()
	{
		clearCanvas();
		drawBack();
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
	function drawBack()
	{
		for (let y = 0; y < canvas.height; y += pixelSize)
		{
			for (let x = 0; x < canvas.width; x += pixelSize)
			{
				const res = network.calculate(normalize(x, y));
				const r = res[0] * 255;
				const g = res[1] * 255;
				const b = res[2] * 255;
				ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
				ctx.fillRect(x, y, pixelSize, pixelSize);
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
			if (trainSpan) trainSpan.innerText = `${trainCount}`;
			if (errorSpan) errorSpan.innerText = error.toFixed(5);
			if (speedSpan) speedSpan.innerText = `${Math.floor((trainCount - trainCountPast) / dt * 1000)}t/s`;
			trainCountPast = trainCount;
			setTimeout(() => redraw = true, 100);
		}
		requestAnimationFrame(train);
	}
	function trainOne()
	{
		let error = 0;
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
				const e = network.train([point.x, point.y], [r1, r2, r3]);
				error += e * e;
				trainCount++;
			}
			catch (e)
			{
				logError(e);
				console.error(e);
			}
		});
		return error;
	}
	function s(x: number)
	{
		return x * x;
	}
	function normalize(x: number, y: number)
	{
		return [x / canvas.width, y / canvas.height];
	}
	function addButton(text: string, parent: HTMLElement, onclick: (btn: HTMLButtonElement) => void)
	{
		const button = document.createElement("button");
		button.innerText = text;
		button.addEventListener("click", onclick.bind(button, button));
		parent.appendChild(button);
		return button;
	}
}

interface Point
{
	x: number,
	y: number,
	color: "red" | "blue" | "green",
	d: number,
}