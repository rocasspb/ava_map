import * as config from '../config';

export interface AspectSvgOptions {
    size?: number;
    interactive?: boolean;
    onClick?: (aspect: string) => void;
}

export function createAspectSVG(selectedAspects: Set<string>, options: AspectSvgOptions = {}): SVGSVGElement {
    const { size = 200, interactive = false, onClick } = options;
    const svgNS = "http://www.w3.org/2000/svg";
    const center = size / 2;
    const radius = size * 0.45; // 90 for 200 size
    const innerRadius = size * 0.15; // 30 for 200 size

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", size.toString());
    svg.setAttribute("height", size.toString());
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.style.display = "block"; // Prevent inline spacing issues

    const sectors = config.ASPECT_DIRECTIONS;
    const anglePerSector = 360 / sectors.length;
    // Rotate so North is at top (-90 degrees)
    // Sector 0 (N) should be centered at -90. So it goes from -90 - 22.5 to -90 + 22.5
    const startAngleOffset = -90 - (anglePerSector / 2);

    sectors.forEach((aspect, index) => {
        const startAngle = startAngleOffset + (index * anglePerSector);
        const endAngle = startAngle + anglePerSector;

        // Convert polar to cartesian
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);

        const x3 = center + innerRadius * Math.cos(endRad);
        const y3 = center + innerRadius * Math.sin(endRad);
        const x4 = center + innerRadius * Math.cos(startRad);
        const y4 = center + innerRadius * Math.sin(startRad);

        // Path definition
        const d = [
            `M ${x1} ${y1}`,
            `A ${radius} ${radius} 0 0 1 ${x2} ${y2}`,
            `L ${x3} ${y3}`,
            `A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4}`,
            `Z`
        ].join(" ");

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", d);
        path.setAttribute("class", "aspect-sector");
        path.setAttribute("data-aspect", aspect);

        if (selectedAspects.has(aspect)) {
            path.classList.add("selected");
        }

        if (interactive) {
            path.style.cursor = 'pointer';
            if (onClick) {
                path.addEventListener('click', () => onClick(aspect));
            }
        }

        // Add tooltip title
        const title = document.createElementNS(svgNS, "title");
        title.textContent = aspect;
        path.appendChild(title);

        svg.appendChild(path);

        // Add Label
        const labelAngle = startAngle + (anglePerSector / 2);
        const labelRad = (labelAngle * Math.PI) / 180;
        const labelRadius = (radius + innerRadius) / 2;
        const lx = center + labelRadius * Math.cos(labelRad);
        const ly = center + labelRadius * Math.sin(labelRad);

        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", lx.toString());
        text.setAttribute("y", ly.toString());
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("class", "aspect-label");
        text.style.pointerEvents = "none"; // Let clicks pass through to path
        text.textContent = aspect;
        // Scale font size based on overall size, roughly
        text.style.fontSize = `${size * 0.08}px`; // ~10px for 200 size

        // For very small graphics, maybe hide labels? Or make them tiny.
        // Let's keep them for now.

        svg.appendChild(text);
    });

    return svg;
}
