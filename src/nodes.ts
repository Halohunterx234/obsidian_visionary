export type NodeType =
	| "node"
	| "category"
	| "placeholder";

export interface BaseNodeData {
	data: {
		id: string;
		color?: string;
		outline_color?: string;
		score: number;
		type: NodeType;
		parent?: string | null;
		size?: number;
	}
}
export interface DataNode extends BaseNodeData {
	type: "node";
	categories: string[];
}
export interface CategoryNode {
	data: BaseNodeData & {
		type: "category";
	}
}
export interface PlaceholderNode {
	data: BaseNodeData & {
		type: "placeholder";
	}
}
export interface CategoryMembership {
	nodeID: string[];
	categoryID: string[]
}

export type Node = DataNode; //| CategoryNode | PlaceholderNode;