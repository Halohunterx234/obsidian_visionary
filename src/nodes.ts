export type NodeType =
	| "node"
	| "category"
	| "placeholder";

export interface Node {
	id: string;
	name: string;
	color: string;
	score: number;
	type: NodeType;
	parentId?: string;
}
export interface KnowledgeNode extends Node {
	type: "node";
	categories: string[];
}
export interface CategoryNode extends Node{
	type: "category";
}
export interface PlaceholderNode extends Node {
	type: "placeholder";
	score: 0;
}
export interface CategoryMembership {
	nodeID: string[];
	categoryID: string[]
}