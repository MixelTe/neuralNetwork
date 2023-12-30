import { backwards, Connections, findError, forwards, Neuron } from "./netFunctions.js";

type Activator = "sigmoid" | "relu" | "tanh" | "linear";

export class Network
{
	private activator: (x: number) => number = (x: number) => x;
	private activatorD: (y: number) => number = () => 1;
	private _activator: Activator = "sigmoid";
	public set Activator(v: Activator)
	{
		this._activator = v;
		switch (v) {
			case "linear":
				this.activator = (x) => x;
				this.activatorD = () => 1;
				break;
			case "sigmoid":
				this.activator = (x) => 1 / (1 + Math.pow(Math.E, -x));
				this.activatorD = (y) => y * (1 - y);
				break;
			case "tanh":
				this.activator = (x) => Math.tanh(x);
				this.activatorD = (y) => 1 - y * y;
				break;
			case "relu":
				this.activator = (x) =>
				{
					if (x > 1) return 1 + 0.01 * (x - 1);
					if (x < 0) return 0.01 * x;
					return x;
				}
				this.activatorD = (y) =>
				{
					if (y > 1) return 0.01;
					if (y < 0) return 0.01;
					return 1;
				};
				break;
		}
	}
	public get Activator()
	{
		return this._activator;
	}

	public learningCoefficient = 0.05;

	public neurons: Neuron[][] = [];
	public connections: Connections[] = [];

	constructor()
	{
		this.Activator = "sigmoid";
	}

	public createNetwork(neuronsCount: number[], addShifting = true)
	{
		if (neuronsCount.length < 2) throw new Error("neuronsCount.length must be at least two");
		this.neurons = [];
		this.connections = [];
		for (let i = 0; i < neuronsCount.length; i++) {
			const count = neuronsCount[i];
			const layer = [];
			const shift = (addShifting && i < neuronsCount.length - 1) ? 1 : 0;
			const ci = this.connections.length;
			if (i != 0) this.connections[ci] = [];
			for (let j = 0; j < count + shift; j++)
			{
				layer.push({
					value: j == count ? 1 : 0,
					error: 0
				});
				if (i == 0) continue;
				this.connections[ci][j] = [];
				if (j == count) continue;

				const prevNodesCount = neuronsCount[i - 1];
				const nextNodesCount = count;
				const std = Math.sqrt(2.0 / prevNodesCount);
				const upper = (Math.sqrt(6.0) / Math.sqrt(prevNodesCount + nextNodesCount))
				const lower = -upper;
				for (let o = 0; o < this.neurons[i - 1].length; o++)
				{
					if (this.Activator == "relu")
						this.connections[ci][j][o] = Math.random() * std;
					else
						this.connections[ci][j][o] = lower + Math.random() * (upper - lower);
					// this.connections[ci][j][o] = Math.random() % 0.5 + 0.25;
					// this.connections[ci][j][o] = 0.2;
				}
			}
			this.neurons[i] = layer;
		}
	}
	public load(data: string)
	{
		const parsed = <Connections[]>JSON.parse(data);
		if (typeof parsed[0][0][0] != "number") throw new Error("Wrong data");
		const neurons = [];
		neurons.push(parsed[0][0].length);
		for (let i = 1; i < parsed.length; i++)
		{
			neurons.push(parsed[i].length);
		}
		this.createNetwork(neurons, false);
		this.connections = parsed;
	}
	public save()
	{
		return JSON.stringify(this.connections);
	}

	public calculate(input: number[])
	{
		for (let i = 0; i < this.neurons[0].length && i < input.length; i++)
		{
			this.neurons[0][i].value = input[i];
		}
		for (let i = 0; i < this.connections.length; i++)
		{
			const connections = this.connections[i];
			forwards(this.neurons[i], connections, this.neurons[i + 1], this.activator);
		}
		const result = [];
		for (let i = 0; i < this.neurons[this.neurons.length - 1].length; i++) {
			const neuron = this.neurons[this.neurons.length - 1][i];
			result.push(neuron.value);
		}
		return result;
	}
	public findError(expectedResult: number[])
	{
		const r = [];
		for (let i = 0; i < this.neurons[this.neurons.length - 1].length; i++) {
			const neuron = this.neurons[this.neurons.length - 1][i];
			r.push(neuron.value);
		}
		let error = 0;
		for (let i = 0; i < r.length; i++)
		{
			const neuron = this.neurons[this.neurons.length - 1][i];
			if (!neuron) break;
			const e = expectedResult[i] - r[i]
			neuron.error = e;
			error += e * e;
		}
		for (let i = this.connections.length - 1; i > 0; i--)
		{
			const connections = this.connections[i];
			findError(this.neurons[i], connections, this.neurons[i + 1]);
		}
		return error / r.length;
	}
	public train(input: number[], expectedResult: number[])
	{
		const r = this.calculate(input);
		let error = 0;
		for (let i = 0; i < r.length; i++)
		{
			const neuron = this.neurons[this.neurons.length - 1][i];
			if (!neuron) break;
			const e = expectedResult[i] - r[i]
			neuron.error = e;
			error += e * e;
		}
		for (let i = this.connections.length - 1; i > 0; i--)
		{
			const connections = this.connections[i];
			findError(this.neurons[i], connections, this.neurons[i + 1]);
		}
		for (let i = 0; i < this.connections.length; i++)
		{
			const connections = this.connections[i];
			backwards(this.neurons[i], connections, this.neurons[i + 1], this.learningCoefficient, this.activatorD);
		}
		return { e: error / r.length, r };
	}
}
