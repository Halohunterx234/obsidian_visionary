export const nodes = [
	{
		data: {
			id: 'programming',
            type: 'category',
            color: '#5EF527',
            outline_color: '#54c52b',			group: 'programming',
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
		},
	},
	{
		data: {
			group: 'machine-learning',
			id: 'machine-learning',
		},
	},
];
