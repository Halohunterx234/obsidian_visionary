export type NodeType =
	| "node"
	| "category"
	| "placeholder";

export interface BaseNodeData {
	id: string;
	color?: string;
	outline_color?: string;
	score: number;
	type: NodeType;
	parent?: string | null;
	size?: string;
}
export interface DataNode extends BaseNodeData {
	data: BaseNodeData & {
		type: "node";
		categories: string[];
	}
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