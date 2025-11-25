
import { ExtractedData, GeneratedFile, PartGeometry } from '../types';

// --- DXF WRITER HELPER ---
class SimpleDxfWriter {
  private content: string[] = [];

  constructor() {
    this.header();
  }

  private header() {
    this.content.push(
      '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'TABLES',
        '0', 'TABLE', '2', 'LAYER', '70', '6',
          // Layer 0
          '0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS',
          // Layer CUT_OUTER (White) - The external contour
          '0', 'LAYER', '2', 'CUT_OUTER', '70', '0', '62', '7', '6', 'CONTINUOUS',
          // Layer CUT_INNER (Red) - Holes and cutouts
          '0', 'LAYER', '2', 'CUT_INNER', '70', '0', '62', '1', '6', 'CONTINUOUS',
          // Layer BEND (Yellow) - Fold lines
          '0', 'LAYER', '2', 'BEND', '70', '0', '62', '2', '6', 'DASHED',
          // Layer DIMENSIONS (Green) - Measurements
          '0', 'LAYER', '2', 'DIMENSIONS', '70', '0', '62', '3', '6', 'CONTINUOUS',
          // Layer TEXT (Cyan) - Etching/Labels
          '0', 'LAYER', '2', 'TEXT', '70', '0', '62', '4', '6', 'CONTINUOUS',
        '0', 'ENDTAB',
      '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES'
    );
  }

  public addLine(x1: number, y1: number, x2: number, y2: number, layer: string = '0', color: number = 7) {
    this.content.push(
      '0', 'LINE',
      '8', layer,
      '62', color.toString(),
      '10', x1.toFixed(3), '20', y1.toFixed(3), '30', '0.0',
      '11', x2.toFixed(3), '21', y2.toFixed(3), '31', '0.0'
    );
  }

  public addPolyline(points: Array<[number, number]>, layer: string = '0', color: number = 7, closed: boolean = true) {
    this.content.push(
      '0', 'POLYLINE', '8', layer, '62', color.toString(), '66', '1', '10', '0.0', '20', '0.0', '30', '0.0', '70', closed ? '1' : '0'
    );
    for (const [x, y] of points) {
      this.content.push('0', 'VERTEX', '8', layer, '10', x.toFixed(3), '20', y.toFixed(3), '30', '0.0');
    }
    this.content.push('0', 'SEQEND');
  }

  public addCircle(cx: number, cy: number, radius: number, layer: string = '0', color: number = 7) {
    this.content.push(
      '0', 'CIRCLE',
      '8', layer,
      '62', color.toString(),
      '10', cx.toFixed(3), '20', cy.toFixed(3), '30', '0.0',
      '40', radius.toFixed(3)
    );
  }

  public addText(text: string, x: number, y: number, height: number, layer: string = 'TEXT', rotation: number = 0) {
    this.content.push(
      '0', 'TEXT',
      '8', layer,
      '10', x.toFixed(3), '20', y.toFixed(3), '30', '0.0',
      '40', height.toString(),
      '50', rotation.toString(),
      '1', text
    );
  }

  // Draw a linear dimension with extension lines and text
  public addDimension(x1: number, y1: number, x2: number, y2: number, value?: number, offset: number = 20) {
    const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    if (dist < 0.1) return; // Ignore tiny dimensions

    const val = value !== undefined ? value : dist;
    
    // Determine angle for offset direction (perpendicular to measurement)
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const perpAngle = angle + Math.PI / 2;
    
    // Gap and Overshoot configuration
    const gap = 2.0;       // Gap from feature to extension line
    const overshoot = 2.0; // Extension past dim line
    
    // Calculate extension line start points (with gap)
    const extStartX1 = x1 + Math.cos(perpAngle) * (Math.sign(offset) * gap);
    const extStartY1 = y1 + Math.sin(perpAngle) * (Math.sign(offset) * gap);
    const extStartX2 = x2 + Math.cos(perpAngle) * (Math.sign(offset) * gap);
    const extStartY2 = y2 + Math.sin(perpAngle) * (Math.sign(offset) * gap);

    // Calculate main dimension line position
    const offX = Math.cos(perpAngle) * offset;
    const offY = Math.sin(perpAngle) * offset;
    const dimX1 = x1 + offX;
    const dimY1 = y1 + offY;
    const dimX2 = x2 + offX;
    const dimY2 = y2 + offY;

    // Calculate extension line end points (overshoot)
    const extEndX1 = dimX1 + Math.cos(perpAngle) * (Math.sign(offset) * overshoot);
    const extEndY1 = dimY1 + Math.sin(perpAngle) * (Math.sign(offset) * overshoot);
    const extEndX2 = dimX2 + Math.cos(perpAngle) * (Math.sign(offset) * overshoot);
    const extEndY2 = dimY2 + Math.sin(perpAngle) * (Math.sign(offset) * overshoot);

    // Draw Extension lines
    this.addLine(extStartX1, extStartY1, extEndX1, extEndY1, 'DIMENSIONS', 3);
    this.addLine(extStartX2, extStartY2, extEndX2, extEndY2, 'DIMENSIONS', 3);

    // Draw Main Dimension Line
    this.addLine(dimX1, dimY1, dimX2, dimY2, 'DIMENSIONS', 3);
    
    // Draw Arrows (Simple Ticks)
    const tickSize = 2.0;
    const tickAngle = angle + Math.PI / 4;
    
    const tick1X = Math.cos(tickAngle) * tickSize;
    const tick1Y = Math.sin(tickAngle) * tickSize;
    
    this.addLine(dimX1 - tick1X, dimY1 - tick1Y, dimX1 + tick1X, dimY1 + tick1Y, 'DIMENSIONS', 3);
    this.addLine(dimX2 - tick1X, dimY2 - tick1Y, dimX2 + tick1X, dimY2 + tick1Y, 'DIMENSIONS', 3);
    
    // Text Position (Midpoint)
    const midX = (dimX1 + dimX2) / 2;
    const midY = (dimY1 + dimY2) / 2;
    
    // Text offset slightly "above" the line
    const textGap = 2; 
    const textX = midX + Math.cos(perpAngle) * textGap;
    const textY = midY + Math.sin(perpAngle) * textGap;

    const textStr = `${val.toFixed(1)}`;
    const textHeight = 3.5;
    const textWidthEstimate = textStr.length * (textHeight * 0.6); 
    
    // Calculate rotation in degrees for DXF (0-360)
    let textRot = (angle * 180 / Math.PI);
    // Normalize text to be readable (not upside down)
    if (textRot > 90 || textRot < -90) {
        textRot += 180;
    }

    this.addText(textStr, textX - (textWidthEstimate/2), textY - (textHeight/2), textHeight, 'TEXT', textRot);
  }

  // Draw a leader callout for holes (e.g., "4x %%C12.0")
  public addCallout(x: number, y: number, text: string, angleDeg: number = 45, length: number = 20) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const endX = x + Math.cos(angleRad) * length;
    const endY = y + Math.sin(angleRad) * length;
    
    // Leader line
    this.addLine(x, y, endX, endY, 'DIMENSIONS', 3);
    
    // Horizontal landing
    const landingLen = 10;
    const direction = Math.sign(Math.cos(angleRad)); // Left or Right based on angle
    const landEndX = endX + (landingLen * direction);
    
    this.addLine(endX, endY, landEndX, endY, 'DIMENSIONS', 3);
    
    // Text
    const textHeight = 3.5;
    // Align text start based on direction
    const textX = direction > 0 ? endX + 2 : endX - 2 - (text.length * textHeight * 0.6);
    this.addText(text, textX, endY + 2, textHeight, 'TEXT');
  }

  public toString(): string {
    this.content.push('0', 'ENDSEC', '0', 'EOF');
    return this.content.join('\n');
  }
}

// --- PARSER FOR PREVIEW ---
export interface DxfEntity {
  type: 'LINE' | 'CIRCLE' | 'POLYLINE' | 'TEXT';
  layer: string;
  color: number;
  points?: {x: number, y: number}[]; 
  center?: {x: number, y: number}; 
  radius?: number; 
  text?: string; 
  height?: number; 
  x?: number; 
  y?: number; 
  closed?: boolean;
}

export interface DxfBounds {
  minX: number; minY: number; maxX: number; maxY: number;
}

export const parseDxf = (content: string): { entities: DxfEntity[], bounds: DxfBounds } => {
  const lines = content.split('\n').map(l => l.trim());
  const entities: DxfEntity[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const updateBounds = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  let i = 0;
  let inEntities = false;
  
  const next = () => {
    if (i >= lines.length) return null;
    return { code: parseInt(lines[i++]), value: lines[i++] };
  };

  const peek = () => {
     if (i >= lines.length) return null;
     return { code: parseInt(lines[i]), value: lines[i+1] };
  };

  while (i < lines.length) {
    const pair = next();
    if (!pair) break;

    if (pair.code === 0 && pair.value === 'SECTION') {
      const p2 = next();
      if (p2 && p2.code === 2 && p2.value === 'ENTITIES') {
        inEntities = true;
        continue;
      }
    }

    if (pair.code === 0 && pair.value === 'ENDSEC') {
      inEntities = false;
    }

    if (inEntities && pair.code === 0) {
      const type = pair.value;
      
      if (type === 'LINE') {
        const line: DxfEntity = { type: 'LINE', layer: '0', color: 7, points: [{x:0,y:0}, {x:0,y:0}] };
        let p = peek();
        while (p && p.code !== 0) {
          next();
          if (p.code === 8) line.layer = p.value;
          if (p.code === 62) line.color = parseInt(p.value);
          if (p.code === 10) line.points![0].x = parseFloat(p.value);
          if (p.code === 20) line.points![0].y = parseFloat(p.value);
          if (p.code === 11) line.points![1].x = parseFloat(p.value);
          if (p.code === 21) line.points![1].y = parseFloat(p.value);
          p = peek();
        }
        updateBounds(line.points![0].x, line.points![0].y);
        updateBounds(line.points![1].x, line.points![1].y);
        entities.push(line);
      } 
      else if (type === 'CIRCLE') {
        const circle: DxfEntity = { type: 'CIRCLE', layer: '0', color: 7, center: {x:0,y:0}, radius: 0 };
        let p = peek();
        while (p && p.code !== 0) {
          next();
          if (p.code === 8) circle.layer = p.value;
          if (p.code === 62) circle.color = parseInt(p.value);
          if (p.code === 10) circle.center!.x = parseFloat(p.value);
          if (p.code === 20) circle.center!.y = parseFloat(p.value);
          if (p.code === 40) circle.radius = parseFloat(p.value);
          p = peek();
        }
        updateBounds(circle.center!.x - circle.radius!, circle.center!.y - circle.radius!);
        updateBounds(circle.center!.x + circle.radius!, circle.center!.y + circle.radius!);
        entities.push(circle);
      }
      else if (type === 'TEXT') {
        const text: DxfEntity = { type: 'TEXT', layer: '0', color: 7, x:0, y:0, height: 10, text: '' };
        let p = peek();
        while (p && p.code !== 0) {
          next();
          if (p.code === 8) text.layer = p.value;
          if (p.code === 62) text.color = parseInt(p.value);
          if (p.code === 10) text.x = parseFloat(p.value);
          if (p.code === 20) text.y = parseFloat(p.value);
          if (p.code === 40) text.height = parseFloat(p.value);
          if (p.code === 1) text.text = p.value;
          p = peek();
        }
        updateBounds(text.x!, text.y!);
        updateBounds(text.x! + (text.text!.length * text.height! * 0.6), text.y! + text.height!);
        entities.push(text);
      }
      else if (type === 'POLYLINE') {
        const poly: DxfEntity = { type: 'POLYLINE', layer: '0', color: 7, points: [], closed: false };
        let p = peek();
        while (p && p.code !== 0) {
          next();
          if (p.code === 8) poly.layer = p.value;
          if (p.code === 62) poly.color = parseInt(p.value);
          if (p.code === 70 && (parseInt(p.value) & 1)) poly.closed = true;
          p = peek();
        }
        
        while(true) {
            const vHeader = next();
            if (!vHeader) break;
            if (vHeader.value === 'SEQEND') break;
            
            if (vHeader.value === 'VERTEX') {
                let vx = 0, vy = 0;
                let vp = peek();
                while(vp && vp.code !== 0) {
                    next();
                    if (vp.code === 10) vx = parseFloat(vp.value);
                    if (vp.code === 20) vy = parseFloat(vp.value);
                    vp = peek();
                }
                poly.points?.push({x: vx, y: vy});
                updateBounds(vx, vy);
            }
        }
        entities.push(poly);
      }
    }
  }

  if (minX === Infinity) { minX=0; maxX=100; minY=0; maxY=100; }
  return { entities, bounds: { minX, minY, maxX, maxY } };
};


// --- GEOMETRY ENGINE ---

// Helper to parse dimensions from strings like "C-Ch 100x50x15"
const parseProfileDims = (name: string, defaultWeb: number): { web: number, flange: number, lip: number } => {
    const match = name.match(/(\d+)[xX](\d+)(?:[xX](\d+))?/);
    if (match) {
        return {
            web: parseFloat(match[1]),
            flange: parseFloat(match[2]),
            lip: match[3] ? parseFloat(match[3]) : 0
        };
    }
    return { web: defaultWeb, flange: 35, lip: 15 }; // Default Flange for tray
};

// Engineering Logic: Calculate Flattened Dimensions accounting for material stretch
const calculateFlatPattern = (segments: number[], thickness: number = 2.0): { flatLength: number, bendPositions: number[] } => {
    const BEND_DEDUCTION = 2.0 * thickness; 
    let flatLength = 0;
    const bendPositions: number[] = [];

    const totalOuter = segments.reduce((a, b) => a + b, 0);
    const totalDeductions = (segments.length - 1) * BEND_DEDUCTION;
    const finalFlatLength = totalOuter - totalDeductions;
    
    for (let i = 0; i < segments.length - 1; i++) {
        const correction = ((i) * BEND_DEDUCTION) + (BEND_DEDUCTION / 2);
        let cumOuter = 0;
        for(let k=0; k<=i; k++) cumOuter += segments[k];
        bendPositions.push(cumOuter - correction);
    }

    return { flatLength: finalFlatLength, bendPositions };
};

export const generateFabricationFiles = (data: ExtractedData): GeneratedFile[] => {
  const files: GeneratedFile[] = [];

  // 1. GENERATE CSV CUT LIST
  const csvRows = [
    "Part Name,Type,Width (mm),Height/Length (mm),Qty,Material,Notes"
  ];
  
  data.Parts_List.forEach(part => {
    csvRows.push(`${part.Part_Name},${part.Type},${part.Width_mm},${part.Height_mm},${part.Qty},${part.Material},${part.Notes || ''}`);
  });

  files.push({
    name: `${data.Unit_Ref}_Production_List.csv`,
    content: csvRows.join('\n'),
    type: 'csv',
    description: 'Master Cut List for all identified parts'
  });

  // 2. GENERATE DXF FILES FOR EACH PANEL
  const panels = data.Parts_List.filter(p => p.Type === 'Panel');

  panels.forEach(panel => {
    const dxf = new SimpleDxfWriter();
    
    // HEURISTIC: Is this a Tray (Panel with flanges) or a Flat Plate?
    // If it's an "Outer" panel or Side panel, usually it's a tray.
    // If Notes say "Flat", treat as flat.
    const isTray = !panel.Notes?.toLowerCase().includes('flat');
    const FLANGE = 35.0; // Standard AHU Flange
    const BEND_DEDUCTION = 1.5; // For 0.8mm
    
    let W = panel.Width_mm;
    let H = panel.Height_mm;
    
    // Geometry Generation
    if (isTray) {
        // TRAY LOGIC WITH CORNER NOTCHING
        // The Width_mm/Height_mm from ExtractedData usually refers to the "Finished Box Size"
        // We need to ADD flanges to get the flat pattern.
        
        // Flat Dimensions = Finished + 2*Flange - 2*Deduction
        const flatW = W + (2 * FLANGE) - (2 * BEND_DEDUCTION);
        const flatH = H + (2 * FLANGE) - (2 * BEND_DEDUCTION);
        
        const notchSize = FLANGE - (BEND_DEDUCTION / 2); // Approximate notch to align corners
        
        // Draw Notched Box (The Cut Line)
        // 12-point polygon for a box with 4 corner notches
        const pts: Array<[number, number]> = [
            [notchSize, 0], [flatW - notchSize, 0], // Bottom Edge
            [flatW - notchSize, notchSize], [flatW, notchSize], // Bottom-Right Notch
            [flatW, flatH - notchSize], [flatW - notchSize, flatH - notchSize], // Right Edge & Top-Right Notch
            [flatW - notchSize, flatH], [notchSize, flatH], // Top Edge
            [notchSize, flatH - notchSize], [0, flatH - notchSize], // Top-Left Notch
            [0, notchSize], [notchSize, notchSize] // Left Edge & Bottom-Left Notch
        ];
        
        dxf.addPolyline(pts, 'CUT_OUTER', 7);
        
        // Draw Bend Lines
        // Left
        dxf.addLine(notchSize, notchSize, notchSize, flatH - notchSize, 'BEND', 2);
        dxf.addText("UP 90", notchSize - 5, flatH/2, 3.5, 'TEXT', 90);
        
        // Right
        dxf.addLine(flatW - notchSize, notchSize, flatW - notchSize, flatH - notchSize, 'BEND', 2);
        dxf.addText("UP 90", flatW - notchSize + 2, flatH/2, 3.5, 'TEXT', 90);

        // Bottom
        dxf.addLine(notchSize, notchSize, flatW - notchSize, notchSize, 'BEND', 2);
        dxf.addText("UP 90", flatW/2, notchSize - 5, 3.5, 'TEXT', 0);

        // Top
        dxf.addLine(notchSize, flatH - notchSize, flatW - notchSize, flatH - notchSize, 'BEND', 2);
        dxf.addText("UP 90", flatW/2, flatH - notchSize + 2, 3.5, 'TEXT', 0);
        
        // Add Procedural Rivet Holes on Flanges
        // Standard pattern: Every 150mm
        const holeSpacing = 150;
        const rivetDia = 4.0;
        const flangeMid = notchSize / 2;
        
        // Top/Bottom Flanges
        const numHolesX = Math.floor((flatW - 2*notchSize) / holeSpacing);
        const spacingX = (flatW - 2*notchSize) / (numHolesX + 1);
        
        for(let i=1; i<=numHolesX; i++) {
            const x = notchSize + (i * spacingX);
            // Bottom Flange Hole
            dxf.addCircle(x, flangeMid, rivetDia/2, 'CUT_INNER', 1);
            // Top Flange Hole
            dxf.addCircle(x, flatH - flangeMid, rivetDia/2, 'CUT_INNER', 1);
        }
        
        // Left/Right Flanges
        const numHolesY = Math.floor((flatH - 2*notchSize) / holeSpacing);
        const spacingY = (flatH - 2*notchSize) / (numHolesY + 1);
        
        for(let i=1; i<=numHolesY; i++) {
            const y = notchSize + (i * spacingY);
            // Left Flange Hole
            dxf.addCircle(flangeMid, y, rivetDia/2, 'CUT_INNER', 1);
            // Right Flange Hole
            dxf.addCircle(flatW - flangeMid, y, rivetDia/2, 'CUT_INNER', 1);
        }

        // Dimensions
        dxf.addDimension(0, 0, flatW, 0, flatW, -50);
        dxf.addDimension(flatW, 0, flatW, flatH, flatH, 50);
        dxf.addDimension(0, 0, notchSize, 0, FLANGE, -25); // Show flange size

        // Update W/H for subsequent hole calculations relative to the flat pattern
        // The original logic assumed W/H was the full size. 
        // We need to map "Finished Part Holes" to "Flat Pattern Coordinates".
        // Center of Finished Part (W/2, H/2) maps to Center of Flat Part (flatW/2, flatH/2).
        
        // Remap user holes
        if (panel.Holes) {
             panel.Holes.forEach(h => {
                 // H.X is relative to finished corner.
                 // New X = H.X + NotchSize (roughly)
                 h.X += notchSize;
                 h.Y += notchSize;
             });
        }
        
        W = flatW;
        H = flatH;
        
    } else {
        // FLAT PLATE LOGIC
        dxf.addPolyline([[0,0], [W,0], [W,H], [0,H]], 'CUT_OUTER', 7);
        dxf.addDimension(0, 0, W, 0, W, -40);
        dxf.addDimension(W, 0, W, H, H, 40);
    }

    // Explicit Holes (from Vision)
    if (panel.Holes && panel.Holes.length > 0) {
      panel.Holes.forEach((hole, idx) => {
        const cx = hole.X;
        const cy = hole.Y;
        
        if (hole.Shape === 'Circle') {
          const radius = hole.W_or_Dia / 2;
          dxf.addCircle(cx, cy, radius, 'CUT_INNER', 1);
          dxf.addCallout(cx + radius, cy + radius, `%%C${hole.W_or_Dia.toFixed(1)}`, 45, 15);
        } else {
          const halfW = hole.W_or_Dia / 2;
          const halfH = (hole.H || hole.W_or_Dia) / 2;
          const pts: Array<[number,number]> = [
            [cx - halfW, cy - halfH], [cx + halfW, cy - halfH],
            [cx + halfW, cy + halfH], [cx - halfW, cy + halfH]
          ];
          dxf.addPolyline(pts, 'CUT_INNER', 1);
          dxf.addCallout(cx + halfW, cy + halfH, `${hole.W_or_Dia}x${hole.H || hole.W_or_Dia}`, 45, 15);
        }
        
        // Datum Dims
        if (cx > 10) dxf.addDimension(0, cy, cx, cy, cx, -(cy + 15 + (idx*10))); 
        if (cy > 10) dxf.addDimension(cx, 0, cx, cy, cy, (cx + 15 + (idx*10)));
      });
    }

    const label = `${data.Unit_Ref} - ${panel.Part_Name} (${panel.Material})`;
    dxf.addText(label, 20, H/2, 20, 'TEXT'); 

    files.push({
      name: `${data.Unit_Ref}_${panel.Part_Name}.dxf`,
      content: dxf.toString(),
      type: 'dxf',
      description: `Drawing: ${panel.Part_Name} (${W.toFixed(0)}x${H.toFixed(0)})`
    });
  });

  // 3. GENERATE PROFILE DXF
  const profiles = data.Parts_List.filter(p => p.Type === 'Profile');
  
  profiles.forEach(prof => {
    const dxf = new SimpleDxfWriter();
    const { web, flange, lip } = parseProfileDims(prof.Part_Name, prof.Height_mm || 100);
    const length = prof.Width_mm; 
    
    const segments: number[] = [];
    if (lip > 0) segments.push(lip);
    segments.push(flange);
    segments.push(web);
    segments.push(flange);
    if (lip > 0) segments.push(lip);
    
    const { flatLength, bendPositions } = calculateFlatPattern(segments, 2.0); 
    
    dxf.addPolyline([[0,0], [length,0], [length,flatLength], [0,flatLength]], 'CUT_OUTER', 7);
    
    let prevY = 0;
    bendPositions.forEach((pos, idx) => {
        dxf.addLine(0, pos, length, pos, 'BEND', 2);
        dxf.addText("UP 90", 10, pos - 2, 3.5, 'TEXT'); // Bend Instruction
        dxf.addDimension(0, 0, 0, pos, pos, -30 - (idx * 10));
        dxf.addDimension(length, prevY, length, pos, pos - prevY, 20);
        prevY = pos;
    });
    
    dxf.addDimension(length, prevY, length, flatLength, flatLength - prevY, 20);
    dxf.addDimension(0, 0, length, 0, length, -20); 
    dxf.addDimension(length, 0, length, flatLength, flatLength, 50); 

    dxf.addText(`${prof.Part_Name} - FLAT PATTERN`, 50, flatLength/2, 10, 'TEXT');

    files.push({
      name: `${data.Unit_Ref}_${prof.Part_Name}_Flat.dxf`,
      content: dxf.toString(),
      type: 'dxf',
      description: `Flat Pattern: ${prof.Part_Name}`
    });
  });

  return files;
};
