import "./nodes"
import { BaseNodeData } from "./nodes"

export const config = {
	"default_node_size": 25,
}


// Some notes on the behaviour of the graph/nodes from the below scenarios
// if a parent only has one node, its size will stay fixed 
// according to the size of its only child
// with two or more children, the size of the parent can then be adjusted

// json version of nodes
const placeholder_node = {
	data: {
		id: 'placeholder',
		color: '#313030',
		outline_color: '#000000',
		score: config.default_node_size,
		type: 'placeholder',
		parent: null
	}
}

const data_node = {
	data: {
		id: 'data',
		color: '#313030',
		outline_color: '#000000',
		score: config.default_node_size,
		type: 'data',
		parent: null
	}
}

const category_node = {
	data: {
		id: 'category',
		color: '#313030',
		outline_color: '#000000',
		score: config.default_node_size,
		type: 'category',
		parent: null
	}
}




export const nodes = [
	// one category with two nodes of varying sizes
	{
		data: {
			id: 'programming',
            color: '#5EF527',
            outline_color: '#54c52b',			
			group: 'programming',
            type: 'category',
            parent: null,
		},
	},
	{
		data: {
			id: 'python',
			group: 'programming',
			parent: 'programming',
            size: 100,
		},
	},
	{
		data: {
			id: 'OOP',
			group: 'programming',
			parent: 'programming',
			size: config.default_node_size
		},
	},

	// individual node with one parent
	{
		data: {
			group: 'machine-learning',
			id: 'machine-learning',
		},
	},
	
	{
		data: {
			group: 'machine-learning',
			id: 'chatgpt',
			parent: 'machine-learning',
			size: config.default_node_size
		}
	},
	
	// placeholder nodes
	{
		data: {
			group: 'math',
			id: 'math (to be done)',
			parent: null,
			size: config.default_node_size,
			color: '#ff0000'
		}
	},
	
	// category and subcategory
	{
		data: {
			id: 'science',
			color: "#0000ff"
		}
	},
	{
		data: {
			id: 'biology',
			parent: 'science',
			color: "#af03fe",
			type: "category"
		}
	},
	{
		data: {
			id: 'fire',
			parent: 'science'
		}
	},
	{
		data: {
			id: "cell",
			parent: 'biology'
		}
	}
];
