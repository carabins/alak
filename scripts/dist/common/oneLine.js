import fs from 'fs';
let lines;
export function getLine() {
    if (!lines) {
        lines = fs.readFileSync('./sonnets').toString().split('\n');
    }
    const oneLine = () => {
        const offset = 16;
        const line = lines[Math.floor(Math.random() * (lines.length - offset)) + offset];
        if (line.length < 10) {
            return oneLine();
        }
        return line.trim();
    };
    return oneLine();
}
//# sourceMappingURL=oneLine.js.map