const consoleDiv = document.getElementById("console");
export function writeLine(text: any, styles: string[])
{
	const div = document.createElement("div");
	div.innerText = text;
	div.classList.add(...styles);
	consoleDiv?.appendChild(div);
	consoleDiv?.scrollTo(0, consoleDiv.scrollHeight);
}
export function log(...text: any[])
{
	let t = "";
	text.forEach(el => t += el + " ");
	writeLine(t, []);
}
export function logError(text: any)
{
	writeLine(text, ["text-error"]);
}