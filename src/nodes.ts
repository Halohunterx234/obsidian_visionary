export type NodeType =
	| "node"
	| "category"
	| "placeholder";


// format for names
// nodes: id: "math", name: "math"
// nodes: id: "math-subjects", name: "math", categories: [subjects]
// categories: id: "category-math", name: "math"

export interface BaseNodeData {
	type: NodeType,
	data: {
		id: string;
		name: string;
		color?: string;
		outline_color?: string;
		score: number;
		parent?: string | null;
		size?: number;
	},
	categories: string[];
}
export interface DataNode extends BaseNodeData {
	type: "node";
}
export interface CategoryNode extends BaseNodeData {
	type: "category";
}
export interface PlaceholderNode extends BaseNodeData {
	type: "placeholder";
}
export interface CategoryMembership {
	nodeID: string[];
	categoryID: string[]
}

export type BaseNode = BaseNodeData; //| CategoryNode | PlaceholderNode;