export interface Hole {
  Shape: 'Circle' | 'Rect';
  X: number; // Center X relative to bottom-left
  Y: number; // Center Y relative to bottom-left
  W_or_Dia: number; // Width or Diameter
  H?: number; // Height (for Rect)
}

export interface PartGeometry {
  Part_Name: string;
  Type: 'Panel' | 'Profile';
  Material: string;
  Qty: number;
  Width_mm: number;
  Height_mm: number;
  Notes?: string;
  Holes?: Hole[];
}

export interface ExtractedData {
  Project_ID: string;
  Unit_Ref: string;
  Global_Dims: {
    L: number;
    W: number;
    H: number;
  };
  Base_Height: number;
  Material_Specs: {
    Outer_Material: string;
    Inner_Material: string;
  };
  Material: {
    Insulation: number;
  };
  Cuts: {
    Fresh_Air: { W: number; H: number };
    Supply_Air: { W: number; H: number };
  };
  Parts_List: PartGeometry[];
}

export interface GeneratedFile {
  name: string;
  content: string; // DXF content or CSV content
  type: 'dxf' | 'csv';
  description: string;
}

export enum ProcessingStep {
  IDLE = 'IDLE',
  READING = 'READING_PDF',
  EXTRACTING = 'AI_EXTRACTION',
  CALCULATING = 'GEOMETRY_ENGINE',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}