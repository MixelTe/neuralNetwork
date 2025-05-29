//   in1   in2   sh3
//  ----------------------
// [ W14   W24   W34 ] out4
// [ W15   W25   W35 ] out5
// [                 ] sh6
/**
 * Calculates neurons values
 * @param l1 Neuron layer
 * @param c Connections between layers
 * @param l2 Next neuron layer to calculate
 * @param activator activating function
 */
export function forwards(l1, c, l2, activator) {
    for (let o = 0; o < l2.length; o++) {
        const no = l2[o];
        let value = 0;
        for (let i = 0; i < l1.length; i++) {
            const ni = l1[i];
            const w = c[o]?.[i];
            if (w == undefined)
                continue;
            value += ni.value * w;
        }
        if (c[o].length > 0)
            no.value = activator(value);
    }
}
/**
 * Calculates neurons errors
 * @param l1 Neuron layer to calculate
 * @param c Connections between layers
 * @param l2 Next neuron layer
 */
export function findError(l1, c, l2) {
    for (let i = 0; i < l1.length; i++) {
        const ni = l1[i];
        ni.error = 0;
        for (let o = 0; o < l2.length; o++) {
            const w = c[o]?.[i];
            if (w == undefined)
                continue;
            ni.error += w * l2[o].error;
        }
    }
}
/**
 * Updates neurons connections
 * @param l1 Neuron layer
 * @param c Connections between layers
 * @param l2 Next neuron layer
 * @param n Learning coefficient
 * @param d derivative of the activating function
 */
export function backwards(l1, c, l2, n, d) {
    for (let o = 0; o < l2.length; o++) {
        const no = l2[o];
        for (let i = 0; i < l1.length; i++) {
            const ni = l1[i];
            if (c[o]?.[i] == undefined)
                continue;
            c[o][i] += n * no.error * d(no.value) * ni.value;
        }
    }
}
