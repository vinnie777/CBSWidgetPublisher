/*
	CBI Widget Publisher
	(c) 2013 - Capital Banking Solutions
*/

/*
 * Widget entry point. 
 */
function cbiWidgetPublisher(dataWidget) {
	showCbiWaitMessage();
	
	dataWidget.clearContent();
	var wgtPlaceholderId = Math.uuid(10, 10);
	dataWidget.addContent("<div id=\"" + wgtPlaceholderId + "\" style=\"width:100%;height:auto;\"></div>");
	
	var cbiPublisher = new CBIPublisher(dataWidget, wgtPlaceholderId);
	cbiPublisher.execute();
}

var PLEASE_WAIT_CBI_WINDOW = null;
function showCbiWaitMessage() {
	PLEASE_WAIT_CBI_WINDOW = Ext.MessageBox.show({ 
		msg: 'Loading the requested information...', 
		progressText: 'Retrieving data...', 
		width:300, 
		wait:true, 
		waitConfig: {interval:1000}
	});
}
function closeCbiWaitMessage() {
	if (PLEASE_WAIT_CBI_WINDOW)
		PLEASE_WAIT_CBI_WINDOW.hide();
}

/*
 * Main class - creates and dispalys all kinds of reports.
 */
function CBIPublisher(dataWidget, wgtPlaceholderId) {
	this.init(dataWidget, wgtPlaceholderId);
	return this;
}

CBIPublisher.prototype.type="CBIPublisher";

CBIPublisher.prototype.init = function(dataWidget, wgtPlaceholderId) {
	// CONSTANTS
	this.SHEET_DATA_QUERY_NAME = "qWidgetPublisherCBI";
	this.MENU_DATA_QUERY_NAME = "qWidgetPublisherCBI_menu";
	this.CHART_DATA_QUERY_NAME = "qWidgetPublisherCBI_chart";
	
	// input params
	this.sheetid = null;
	
	// general data
	this.dataWidget = dataWidget;
	this.wgtPlaceholderId = wgtPlaceholderId;
	this.items = null;
	this.maxWidgetHeight = $(window).height() - 170;// minus footer+header
	this.maxWidgetWidth = $(window).width() - 120;// minus left menu
	
	// TREE
	this.reportName = '';
	this.treeColumns = new Array();
	this.treeFields = new Array();
	this.treeData = new Array();
	this.totalColumnsCount = null;
	this.treeLevelsCount = null;
	this.treeColumnsCount = null;
	
	// DRILL-DOWN MENU
	this.drillDownMenu = new Array();
	
	// CHARTS MENU
	this.chartsMenu = new Array();
	
	// CHARTS themselves
	this.chart = new Object();
	
	// GRAPHICAL COMPONENT IDS
	this.mainPanelId = "cbiPublisherMainPanel_" + this.wgtPlaceholderId;
	this.mainTreeId = "cbiPublisherMainTree_" + this.wgtPlaceholderId;
	this.tabPanelId = "cbiPublisherTabPanel_" + this.wgtPlaceholderId;
	
	return this;
}

CBIPublisher.prototype.setItems = function(items) {
	this.items = items;
}

CBIPublisher.prototype.setReportName = function(name) {
	if (name === null || name === undefined || name === "null" || name === "undefined")
		name = '';
	this.reportName = name;
}

CBIPublisher.prototype.execute = function() {
	// render main report panel
	this.renderReport();
	
	// build report elements
	this.sheetid = "100002301";
	var wsParams = {sheetid: this.sheetid};
	this.buildReport(this.SHEET_DATA_QUERY_NAME, this.parseTreeItem, this.prepareTreeReport, wsParams);// TREE
	
	wsParams = {sheetid: this.sheetid};
	this.buildReport(this.MENU_DATA_QUERY_NAME, this.parseMenuItem, this.prepareMenuReport, wsParams);// CHARTS menu
}

CBIPublisher.prototype.buildReport = function(dataQueryName, parseCallback, prepareGraphicalComponentCallback, wsParams) {
	var cbi_publisher_instance = this;
	
	var dq = new DataQuery(dataQueryName);
	dq.setParameters(wsParams);
	
	dq.execute(null, function(dataSet) {
		var buffer = dataSet.getData();
		if (buffer !== null && buffer["dsbResult"] !== null) {
			var items = null;
			if (buffer[0] !== null && buffer[0] !== undefined)
				items = buffer[0].dsbResult;
			else
				items = buffer.dsbResult;
			
			var parseContinue = true;
			var parseIndex = 0;
			var loopIndex = 0;
			var loopLimit = 2000;
			
			cbi_publisher_instance.setItems(items);
			
			while (parseContinue) {
				loopIndex++;
				if (items[parseIndex]) {
					parseIndex = parseCallback(items[parseIndex], parseIndex, cbi_publisher_instance, wsParams);
					if (parseIndex >= items.length || loopIndex > loopLimit) {
						parseContinue = false;
					}	
				}
				else {// only one element instead of an Array
					parseIndex = parseCallback(items, 0, cbi_publisher_instance, wsParams);
					parseContinue = false;
				}
			}
			
			cbi_publisher_instance.renderReportElement(prepareGraphicalComponentCallback(cbi_publisher_instance, wsParams), wsParams);
		}
	});
}

CBIPublisher.prototype.parseTreeItem = function(item, index, cbi_publisher_instance, wsParams) {
	if (index === 0) {
		cbi_publisher_instance.setReportName( item.title );
		cbi_publisher_instance.totalColumnsCount = parseInt( item.columnsCount );
		cbi_publisher_instance.treeLevelsCount = parseInt( item.countcolumnshierarchical );
		cbi_publisher_instance.treeColumnsCount = cbi_publisher_instance.totalColumnsCount - cbi_publisher_instance.treeLevelsCount + 1;
		
		var colLabels = item.labelsText.split(',');
		for (var i = 1; i <= cbi_publisher_instance.treeColumnsCount; i++) {
			if (i === 1) {
				cbi_publisher_instance.treeColumns.push({ header: 'Description', dataIndex: 'c' + i, flex: 1, xtype: 'treecolumn' });
			} else {
				//TODO: take width from WS. May be, make align dynamic, depending on type (if double - it's on the right)
				cbi_publisher_instance.treeColumns.push({ header: colLabels[cbi_publisher_instance.treeLevelsCount + i - 2], dataIndex: 'c' + i, align: 'right', width: 150 });
			}

			cbi_publisher_instance.treeFields.push({ name: 'c' + i });
		}
		
		// hidden columns to store the data for the drill down menu
		cbi_publisher_instance.treeColumns.push({ header: 'auditCellRow', dataIndex: 'auditCellRow', hidden: true });
		cbi_publisher_instance.treeColumns.push({ header: 'auditCellDimLevel', dataIndex: 'auditCellDimLevel', hidden: true });
		cbi_publisher_instance.treeFields.push({ name: 'auditCellRow' });
		cbi_publisher_instance.treeFields.push({ name: 'auditCellDimLevel' });
	}
	
	if (item.sessionId !== "9") {
		var row = new Object();
		row.c1 = item["c0" + item.sessionId];// Tree column data
		row.level = parseInt( item.sessionId );// Tree column level
		
		for (var i = 2; i <= (cbi_publisher_instance.treeColumns.length - 2); i++) {// other columns data: NOTE, THAT 2 DRILL DOWN COLUMNS ARE NOT COUNTED!
			var colData = item["c0" + (cbi_publisher_instance.totalColumnsCount - cbi_publisher_instance.treeLevelsCount + i - 2)];
			row["c" + i] = ( isNaN(colData) ) ? colData : parseFloat(colData).toLocaleString();// use ExtJS function to take locale into account
		}
		
		// data for the drill down menu
		row.auditCellRow = item.dsbRepLinId;
		row.auditCellDimLevel = item.dimLevelCode;
		
		cbi_publisher_instance.treeData.push(row);
	}

	return ++index;
}

CBIPublisher.prototype.parseMenuItem = function(item, index, cbi_publisher_instance, wsParams) {
	if (item.c05 && item.c07 && item.c08) {
		if (item.c05 === wsParams.sheetid && item.c08.indexOf("G_") === 0) {
			cbi_publisher_instance.chartsMenu.push({ 'graphid': item.c07, 'menuTitle': item.c08.substring(2, item.c08.length) });
		} else if (item.c05 === wsParams.sheetid && item.c08.indexOf("D_") === 0) {
			cbi_publisher_instance.drillDownMenu.push({ 'title': item.c08.substring(2, item.c08.length), 'auditCellDataId': item.c07 });
		}
	}

	return ++index;
}

CBIPublisher.prototype.getChartSuffix = function(graphid) {
	return "_" + graphid;
}

CBIPublisher.prototype.parseChartItem = function(item, index, cbi_publisher_instance, wsParams) {
	wsParams.graphType = item.graphType;
	var chartType = cbi_publisher_instance.getChartType( item.graphType );
	
	if (chartType.BAR_VERT_STACK)
		return cbi_publisher_instance.parseBarChartItem(item, index, cbi_publisher_instance, wsParams);
	else if (chartType.LINE_VERT_ABS)
		return cbi_publisher_instance.parseLineChartItem(item, index, cbi_publisher_instance, wsParams);
}

CBIPublisher.prototype.getChartType = function(graphType) {
	var chartType = new Object();
	
	if (graphType === "BAR_VERT_STACK")
		chartType.BAR_VERT_STACK = true;
	else if (graphType === "LINE_VERT_ABS")
		chartType.LINE_VERT_ABS = true;
	
	return chartType;
}

CBIPublisher.prototype.parseBarChartItem = function(item, index, cbi_publisher_instance, wsParams) {
	var chartSuffix = cbi_publisher_instance.getChartSuffix( wsParams.graphid );
	
	if (index === 0) {
		cbi_publisher_instance.chart["series" + chartSuffix] = new Array();
		cbi_publisher_instance["currentSerie" + chartSuffix] = -1;
		cbi_publisher_instance["treeLevelsCount" + chartSuffix] = parseInt( item.countcolumnshierarchical );
		cbi_publisher_instance["currentChartLevel" + chartSuffix] = cbi_publisher_instance["treeLevelsCount" + chartSuffix];
		
		var colLabels = item.labelsText.split(',');
		for (var i = cbi_publisher_instance["treeLevelsCount" + chartSuffix]; i < colLabels.length; i++) {
			var serie = new Object();
			serie.name = colLabels[i];
			serie.data = new Array();
			
			var serieNotExists = true;// do not add series with the same name
			for (var j = 0; j < cbi_publisher_instance.chart["series" + chartSuffix].length; j++) {
				if (cbi_publisher_instance.chart["series" + chartSuffix][j].name === serie.name)
					serieNotExists = false;
			}
			if (serieNotExists)
				cbi_publisher_instance.chart["series" + chartSuffix].push(serie);
		}
	}
	
	if (item.sessionId === "1") {
		cbi_publisher_instance["currentSerie" + chartSuffix] = cbi_publisher_instance["currentSerie" + chartSuffix] + 1;
		cbi_publisher_instance["currentChartLevel" + chartSuffix] = cbi_publisher_instance["currentChartLevel" + chartSuffix] + 1;
	}
	else if (item.sessionId !== "1" && item.sessionId !== "9") {
		var serieElem = new Object();
		serieElem.name = item.c02;
		serieElem.value = item["c0" + cbi_publisher_instance["currentChartLevel" + chartSuffix]];
		if (cbi_publisher_instance.chart["series" + chartSuffix][ cbi_publisher_instance["currentSerie" + chartSuffix] ])
			cbi_publisher_instance.chart["series" + chartSuffix][ cbi_publisher_instance["currentSerie" + chartSuffix] ].data.push(serieElem);
	}

	return ++index;
}

CBIPublisher.prototype.parseLineChartItem = function(item, index, cbi_publisher_instance, wsParams) {
	var chartSuffix = cbi_publisher_instance.getChartSuffix( wsParams.graphid );
	
	if (index === 0) {
		cbi_publisher_instance.chart["series" + chartSuffix] = new Array();
		cbi_publisher_instance["treeLevelsCount" + chartSuffix] = parseInt( item.countcolumnshierarchical );
		
		var colLabels = item.labelsText.split(',');
		for (var i = cbi_publisher_instance["treeLevelsCount" + chartSuffix]; i < colLabels.length; i++) {
			var serie = new Object();
			serie.name = colLabels[i];
			
			var serieNotExists = true;// do not add series with the same name
			for (var j = 0; j < cbi_publisher_instance.chart["series" + chartSuffix].length; j++) {
				if (cbi_publisher_instance.chart["series" + chartSuffix][j].name === serie.name)
					serieNotExists = false;
			}
			if (serieNotExists)
				cbi_publisher_instance.chart["series" + chartSuffix].push(serie);
		}
	}
	
	if (item.sessionId !== "1" && item.sessionId !== "9") {
		for (var i = 0; i < cbi_publisher_instance.chart["series" + chartSuffix].length; i++) {
			cbi_publisher_instance.chart["series" + chartSuffix][i][item.c02] = parseFloat( item["c0" + (cbi_publisher_instance["treeLevelsCount" + chartSuffix] + 1 + i)] );
		}
	}

	return ++index;
}

CBIPublisher.prototype.calcCompsInitialSize = function() {
	var initialSize = new Object();
	initialSize.treeMaxHeight = this.maxWidgetHeight * 9 / 10;
	initialSize.tabMaxHeight = this.maxWidgetHeight * 9 / 10;
	initialSize.mainPanelWidth = this.maxWidgetWidth;
    initialSize.mainPanelHeight = this.maxWidgetHeight;
    initialSize.treeWidth = this.maxWidgetWidth / 2;
    return initialSize;
}

CBIPublisher.prototype.prepareTreeReport = function(cbi_publisher_instance) {
	var panelItems = new Array();
	var initialSize = cbi_publisher_instance.calcCompsInitialSize();// get the components initial size
	
	var jsonStoreDef = cbiPublisherTree.getTreeAsJson(cbi_publisher_instance.treeData);// prepare the data for the TreeStore and get them as a JSON object
	if (jsonStoreDef.children !== undefined) {// create a Tree component using the prepared data
		panelItems.push({
			xtype: "treepanel",
			itemId: cbi_publisher_instance.mainTreeId,
			maxHeight: initialSize.treeMaxHeight,
			width: initialSize.treeWidth,
			region:'west',
			margin: '0, 10, 0, 0',
			useArrows: true,
			rootVisible: false,
	    	columns: cbi_publisher_instance.treeColumns,
		    store: Ext.create("Ext.data.TreeStore", { fields: cbi_publisher_instance.treeFields, root: jsonStoreDef }),
		    selType: 'cellmodel',
			listeners: {
		    	cellclick: function(table, td, cellIndex, record, tr, rowIndex, e, eOpts) {
		    		var cellValue = record.data['c' + (cellIndex+1)];//TODO: now it depends on the columns naming during parsing, must be independent
		    		if (cellIndex !== 0)
		    			cbi_publisher_instance.treeClickAction(e, record, cellValue, cbi_publisher_instance);
		    	}
	    	}
		});
	}

	return panelItems;
}

CBIPublisher.prototype.prepareMenuReport = function(cbi_publisher_instance) {
	var initialSize = cbi_publisher_instance.calcCompsInitialSize();// get the components initial size
	
	// CHARTS MENU
	var tabs = new Array();
	for (var i = 0; i < cbi_publisher_instance.chartsMenu.length; i++) {
		tabs.push({ itemId: cbi_publisher_instance.chartsMenu[i].graphid, 'title': cbi_publisher_instance.chartsMenu[i].menuTitle, layout: 'fit' });
	}
	
	var tabContainer = Ext.create('Ext.tab.Panel', {
		itemId: cbi_publisher_instance.tabPanelId,
		plain: true,
		tabPosition: 'bottom',
		maxHeight: initialSize.tabMaxHeight,
		region:'center',
		items: tabs
	});
	
	// CHARTS
	for (var i = 0; i < cbi_publisher_instance.chartsMenu.length; i++) {
		cbi_publisher_instance.buildReport(cbi_publisher_instance.CHART_DATA_QUERY_NAME,
				cbi_publisher_instance.parseChartItem, cbi_publisher_instance.prepareChartReport,
				{"graphid": cbi_publisher_instance.chartsMenu[i].graphid});
	}
	
	return tabContainer;
}

CBIPublisher.prototype.prepareChartReport = function(cbi_publisher_instance, wsParams) {
	var panelItems = new Array();
	var initialSize = cbi_publisher_instance.calcCompsInitialSize();// get the components initial size
	
	// CHARTS
	var chartBuilder = new CBIPublisherChartBuilder(cbi_publisher_instance, wsParams);
	var charts = chartBuilder.buildCharts();
	panelItems.push(charts);
	
	return panelItems;
}

CBIPublisher.prototype.renderReport = function() {
	var initialSize = this.calcCompsInitialSize();// get the components initial size
	
	$("body").append("<style type=\"text/css\">" +
			".cbiPublisherWhite .x-panel-body {" +
				"background-color: white;" +
			"}" +
		"</style>");
	
	var tempPlaceholders = new Array();
	tempPlaceholders.push({
		itemId: 'treePlaceholder',
		maxHeight: initialSize.treeMaxHeight,
		width: initialSize.treeWidth,
		region:'west',
		margin: '0, 10, 0, 0'
	});
	
	// MAIN PANEL
	this.reportPanel = Ext.create('Ext.panel.Panel', {
		itemId: this.mainPanelId,
    	width: initialSize.mainPanelWidth,
	    height: initialSize.mainPanelHeight,
	    overflowX: "auto",
	    overflowY: "auto",
	    border: false,
    	renderTo: this.wgtPlaceholderId,
    	layout: "border",
    	cls:'cbiPublisherWhite',
	    items: tempPlaceholders
	});
}

CBIPublisher.prototype.renderReportElement = function(panelItems, wsParams) {
	console.log(this);
	
	if (panelItems[0] && panelItems[0].xtype === "chart") {
		var tab = this.reportPanel.getComponent(this.tabPanelId).getComponent(wsParams.graphid);
		tab.add(panelItems);
	} else {
		if (panelItems[0] && panelItems[0].xtype === "treepanel")
			this.reportPanel.remove( this.reportPanel.getComponent('treePlaceholder') );
		
		this.reportPanel.add(panelItems);
	}
	
	closeCbiWaitMessage();
}

CBIPublisher.prototype.treeClickAction = function(event, record, cellValue, cbi_publisher_instance) {
	event.stopEvent();
	
	var buildDrillDownMenuItem = function(drillDownMenu) {
    	return {
    		text: drillDownMenu.title,
			handler: function() {
	    		var wsDrillDownParams = {
	    			sheetId: cbi_publisher_instance.sheetid,
	    			auditCellDataId: drillDownMenu.auditCellDataId,
	    			auditCellRow: record.get('auditCellRow'),
	    			auditCellDimLevel: record.get('auditCellDimLevel'),
	    			auditCellCol: 'c03'//cellValue
	    		};
	    		
	    		showCbiWaitMessage();
	    		var publisherDrillDown = new CBIPublisherDrillDown(cbi_publisher_instance, wsDrillDownParams);
	    		publisherDrillDown.executeDrillDown();		
	    	}
	    }
    };
    
	var items = new Array();
	for (var i = 0; i < cbi_publisher_instance.drillDownMenu.length; i++) {
		items.push( buildDrillDownMenuItem(cbi_publisher_instance.drillDownMenu[i]) );
	}
    
    var menu = new Ext.menu.Menu({
    	plain: true,
    	items: items
	}).showAt(event.xy);
}

/*
 * Class to build the charts.
 */
function CBIPublisherChartBuilder(cbi_publisher_instance, wsParams) {
	this.cbi_publisher_instance = cbi_publisher_instance;
	this.graphid = wsParams.graphid;
	
	this.chartType = cbi_publisher_instance.getChartType( wsParams.graphType );	
}

CBIPublisherChartBuilder.prototype.type = "CBIPublisherChartBuilder";

CBIPublisherChartBuilder.prototype.buildCharts = function() {
	if (this.chartType.BAR_VERT_STACK)
		return this.buildStackedBarChart(this.cbi_publisher_instance.chart);
	else if (this.chartType.LINE_VERT_ABS)
		return this.buildLineChart(this.cbi_publisher_instance.chart);
}

CBIPublisherChartBuilder.prototype.buildStackedBarChart = function(chartDef) {
	var chartSuffix = this.cbi_publisher_instance.getChartSuffix(this.graphid);
	var data = new Array();
	var fields = new Array();
	fields.push("name");

	for (var i = 0; i < chartDef["series" + chartSuffix].length; i++) {
		var serie = new Object();
		serie.name = chartDef["series" + chartSuffix][i].name;
		
		for (var j = 0; j < chartDef["series" + chartSuffix][i].data.length; j++) {
			serie[ chartDef["series" + chartSuffix][i].data[j].name ] = parseFloat( chartDef["series" + chartSuffix][i].data[j].value );
			fields.push( chartDef["series" + chartSuffix][i].data[j].name );
		}
		
		data.push(serie);
	}
	
	// add missing fields (with zero value) to all the data arrays - to hack the stacked bar chart
	for (var i = 1; i < fields.length; i++) {
		for (var j = 0; j < data.length; j++) {
			var propDoesNotExists = true;
			for (var propName in data[j]) {
				if (data[j].hasOwnProperty(propName)) {
					if (propName === fields[i])
						propDoesNotExists = false;
				}
			}
			if (propDoesNotExists)
				data[j][ fields[i] ] = 0;
		}	
	}
	
	var xFields = fields.slice(0, 1);
	var yFields = fields.slice(1, fields.length);
	
	var store = Ext.create('Ext.data.JsonStore', {
	    fields: fields,
	    data: data
	});

	var barChart = {
		xtype: 'chart',
		animate: true, 
	    store: store,
	    legend: {
            position: 'right'
        },
	    axes: [{
	        type: 'Numeric',
	        position: 'left',
	        fields: yFields,
	        label: {
	            renderer: Ext.util.Format.numberRenderer('0.000')
	        },
	        grid: true,
	        minimum: 0
	    }, {
	        type: 'Category',
	        position: 'bottom',
	        fields: xFields
	    }],
	    series: [{
	        type: 'bar',
	        axis: 'bottom',
	        highlight: true,
	        column: true,
	        stacked: true,
	        tips: {
	        	trackMouse: true,
	        	width: 200,
	        	height: 35,
	        	renderer: function(storeItem, item) {
	        		this.setTitle(storeItem.get('name') + ': ' + Ext.util.Format.number(item.value[1], '0.000'));
	        	}
	        },
	        xField: xFields,
	        yField: yFields
	    }]
	};
    
    return barChart;
}

CBIPublisherChartBuilder.prototype.buildLineChart = function(chartDef) {
	var chartSuffix = this.cbi_publisher_instance.getChartSuffix(this.graphid);
	
	var fields = new Array();
	for (var propName in chartDef["series" + chartSuffix][0]) {
		if (chartDef["series" + chartSuffix][0].hasOwnProperty(propName))
			fields.push(propName);
	}
	
	var xFields = fields.slice(0, 1);
	var yFields = fields.slice(1, fields.length);
	
	var series = new Array();
	for (var i = 1; i < fields.length; i++) {
		series.push({ 'type': 'line', 'xField': 'name', 'yField': fields[i] });
	}
	
	var store = Ext.create('Ext.data.JsonStore', {
		fields: fields,
	    data: chartDef["series" + chartSuffix]
	});
	
	var chart = {
		xtype: 'chart',
		store: store,
		legend: {
            position: 'right'
        },
        axes: [{
        	type: 'Numeric',
        	position: 'left',
        	grid: true,
        	fields: yFields
        },{
        	type: 'Category',
        	position: 'bottom',
        	fields: xFields
        }],
        series: series
	};
    
    return chart;
}

/*
 * Class to drill down.
 */
function CBIPublisherDrillDown(cbi_publisher_instance, wsDrillDownParams) {
	// CONSTANTS
	this.DRILL_DOWN_DATA_QUERY_NAME = "qWidgetPublisherCBI_popup";

	// general data
	this.cbi_publisher_instance = cbi_publisher_instance;
	this.wsDrillDownParams = wsDrillDownParams;
	this.wgtPlaceholderId = Math.uuid(10, 10);
	
	// GRID
	this.reportName = '';
	this.gridColumns = new Array();
	this.gridFields = new Array();
	this.gridData = new Array();
	this.totalColumnsCount = null;
}

CBIPublisherDrillDown.prototype.type = "CBIPublisherDrillDown";

CBIPublisherDrillDown.prototype.executeDrillDown = function() {
	var cbi_drill_down_instance = this;
	
	var dq = new DataQuery( this.DRILL_DOWN_DATA_QUERY_NAME );
	dq.setParameters( this.wsDrillDownParams );
	
	dq.execute(null, function(dataSet) {
		var buffer = dataSet.getData();
		
		if (buffer !== null && buffer["dsbResult"] !== null) {
			var items = null;
			if (buffer[0] !== null && buffer[0] !== undefined)
				items = buffer[0].dsbResult;
			else
				items = buffer.dsbResult;
			
			var parseContinue = true;
			var parseIndex = 0;
			var loopIndex = 0;
			var loopLimit = 2000;
			
			cbi_drill_down_instance.setItems(items);
			
			while (parseContinue) {
				loopIndex++;
				if (items[parseIndex]) {
					parseIndex = cbi_drill_down_instance.parseGridItem(items[parseIndex], parseIndex);
					if (parseIndex >= items.length || loopIndex > loopLimit) {
						parseContinue = false;
					}	
				}
				else {// only one element instead of an Array
					parseIndex = cbi_drill_down_instance.parseGridItem(items, 0);
					parseContinue = false;
				}
			}
			
			cbi_drill_down_instance.renderReport();
			closeCbiWaitMessage();
		}
	});
}

CBIPublisherDrillDown.prototype.setItems = function(items) {
	this.items = items;
}

CBIPublisherDrillDown.prototype.parseGridItem = function(item, index) {
	if (index === 0) {
		this.reportName = item.title;
		this.totalColumnsCount = parseInt( item.columnsCount );
		
		var colLabels = item.labelsText.split(',');
		var dataTypes = item.dataTypesText.split(',');
		for (var i = 1; i <= this.totalColumnsCount; i++) {
			var textAlign = (dataTypes[i-1] === "double") ? "right" : "left";
			
			this.gridColumns.push({ header: colLabels[i-1], dataIndex: 'c0' + i, flex: 1, align: textAlign });
			this.gridFields.push({ name: 'c0' + i });
		}
	}
	
	var row = new Object();
	for (var i = 1; i <= this.totalColumnsCount; i++) {
		var colData = item['c0' + i];
		row["c0" + i] = ( isNaN(colData) ) ? colData : parseFloat(colData).toLocaleString();// use ExtJS function to take locale into account
	}
	
	this.gridData.push(row);

	return ++index;
}

CBIPublisherDrillDown.prototype.renderReport = function() {
	console.log(this);
	var initialSize = this.cbi_publisher_instance.calcCompsInitialSize();// get the components initial size
	var items = new Array();
	
	items.push({
		border: false,
		width: initialSize.mainPanelWidth / 2,
		html: this.buildBreadcrumbHTML()
	});
	
	items.push({
		xtype: "grid",
		maxHeight: initialSize.mainPanelHeight - 50,
		width: initialSize.mainPanelWidth,
    	columns: this.gridColumns,
	    store: Ext.create("Ext.data.Store", { fields: this.gridFields, data: this.gridData })
	});
	
	// hide previous report placeholder
	$("#" + this.cbi_publisher_instance.wgtPlaceholderId).hide("slide", {direction: "left"}, 500, function() {});

	// display the placeholder for the drill down report
	this.cbi_publisher_instance.dataWidget.addContent("<div id=\"" + this.wgtPlaceholderId + "\" style=\"width:100%;height:auto;\"></div>");
	
	$("body").append("<style type=\"text/css\">" +
		".cbiPublisherWhite .x-panel-body {" +
			"background-color: white;" +
		"}" +
	"</style>");
	
	// DRILL DOWN PANEL
	Ext.create('Ext.panel.Panel', {
		width: initialSize.mainPanelWidth,
	    height: initialSize.mainPanelHeight,
	    border: false,
    	renderTo: this.wgtPlaceholderId,
    	layout: "border",
    	cls:'cbiPublisherWhite',
		layout: {
		    type: "vbox",
	    	align: "stretch",
	    	defaultMargins: {top: 4, right: 0, bottom: 0, left: 0}
		},
	    items: items
	});
}

CBIPublisherDrillDown.prototype.buildBreadcrumbHTML = function() {
	var cbi_drill_down_instance = this;
	var backLinksHTML = '';
	var wizardCSS = '<style type="text/css">' +
		'nav {' +
	    'background: #eee;' +
	    'border: 1px solid #bbb;' +
	    '-webkit-border-radius: 2px;' +
	    '-moz-border-radius: 2px;' +
	    'border-radius: 2px;' +
	    'color: #666;' +
	    'font: 14px/1 "Myriad Pro", Arial, Helvetica, Tahoma, sans-serif;' +
	    'height: 30px;' +
	    'text-shadow: 0 1px 1px #fff;' +
	    'overflow: hidden;' +
	    'margin: 0px;' +
		'}' +
		'nav ul {' +
		    'float: left;' +
		'}' +
		'nav ul li {' +
		    'float: right;' +
		    'padding: 8px 0;' +
		    'text-indent: 37px;' +
		'}' +
		'nav ul li:last-child {' +
		    'margin-left: -15px;' +
		'}' +
		'nav ul li a {' +
		    'background: #ddd;' +
		    'background-image: -webkit-linear-gradient(left top, #eee 38%, #ddd 61%);' +
		    'background-image: -moz-linear-gradient(left top, #eee 38%, #ddd 61%);' +
		    'background-image: -o-linear-gradient(left top, #eee 38%, #ddd 61%);' +
		    'background-image: -ms-linear-gradient(left top, #eee 38%, #ddd 61%);' +
		    'background-image: linear-gradient(left top, #eee 38%, #ddd 61%);' +
		    'border: 1px solid #ccc;' +
		    'color: #666;' +
		    'display: block;' +
		    'line-height: 12px;' +
		    'margin-top: -60px;' +
		    'padding: 60px 0;' +
		    'text-decoration: none;' +
		    'text-shadow: 0 1px 1px #fff;' +
		    'width: 132px;' +
		    '-webkit-transform: rotate(45deg);' +
		    '-moz-transform: rotate(45deg);' +
		    '-o-transform: rotate(45deg);' +
		    '-ms-transform: rotate(45deg);' +
		    'transform: rotate(45deg);' +
		'}' +
		'nav ul li a:hover {' +
		    'background: #ddd;' +
		    'background-image: none;' +
		'}' +
		'nav ul li a:active, nav ul li a:focus {' +
		    'outline: 0;' +
		'}' +
		'nav ul li a span {' +
		    'display: block;' +
		    '-webkit-transform: rotate(-45deg);' +
		    '-moz-transform: rotate(-45deg);' +
		    '-o-transform: rotate(-45deg);' +
		    '-ms-transform: rotate(-45deg);' +
		    'transform: rotate(-45deg);' +
		    'overflow:hidden;' +
		    'white-space:nowrap;' +
		    'text-overflow:ellipsis;' +
		'}' +
		'nav ul li a:active span {' +
		    'bottom: -1px;' +
		    'left: 1px;' +
		    'position: relative;' +
		'}' +
	'</style>';
	
	// add 'previous' steps
	var prevPlaceholderLinkId = Math.uuid(10, 10);
	backLinksHTML = '<li><a href="#" id="' + prevPlaceholderLinkId + '"><span>' + this.cbi_publisher_instance.reportName + '</span></a></li>';
	$("body").on("click", "#" + prevPlaceholderLinkId, function(event) {
		$("#" + cbi_drill_down_instance.wgtPlaceholderId).hide("slide", {direction: "right"}, 300, function() {
			$("#" + cbi_drill_down_instance.cbi_publisher_instance.wgtPlaceholderId).show("slide", {}, 300, function() {});
		});
	});
	
	// add 'current/last' step (not clickable)
	backLinksHTML = '<li>' + this.reportName + '</li>' + backLinksHTML;
	
	if (backLinksHTML !== '')
		backLinksHTML = '<nav><ul>' + backLinksHTML + '</ul></nav>' + wizardCSS;
	
	return backLinksHTML;
}

var cbiPublisherTree = (function() {
	var getTreeAsJson = function(stream) {
		/*
		 * Tree node Object (uses Composite Design Pattern).
		 */
		function TreeNode(dataColumns, level) {
			// create main data columns
			if (dataColumns !== 'root') {
				for (var propName in dataColumns) {
					if (dataColumns.hasOwnProperty(propName)) {
						if (propName !== 'level')
							this[propName] = dataColumns[propName];
					}
				}
			} else {
				this.text = dataColumns;
			}
				
			this.level = level;
			this.children = new Array();
			this.parentNode = null;
			
			this.addChild = function(child) {
				child.parentNode = this;
				this.children.push(child);
			}
			
			this.getParentOfLevel = function(level) {
				if (this.parentNode.level < level)
					return this.parentNode;
				else
					return this.parentNode.getParentOfLevel(level);
			}
			
			this.getTreeAsStoreDef = function() {
				var result = null;
				
				if (this.text !== undefined)
					result = "{\"text\":\".\"";
				else {
					result = "{";
					for (var propName in this) {
						if (dataColumns.hasOwnProperty(propName)) {
							if (propName !== 'level') {
								result = result + "\"" + propName + "\":\"" + this[propName] + "\", ";
							}
						}
					}
					result = result.substring(0, result.length-2);
				}
				
				if (this.children.length == 0) {
					result = result + ", \"leaf\":true, \"iconCls\":\"x-tree-noicon\"}";
				}
				else {
					result = result + ", \"children\":[";
					for (var idx = 0; idx < this.children.length; idx++) {
						result = result + this.children[idx].getTreeAsStoreDef();
						if (idx !== (this.children.length-1))
							 result = result + ", ";
					}
					result = result + "], \"iconCls\":\"x-tree-noicon\"}";
				}
				return result;
			}
		}
		
		// Transform the stream array with 'level' attributes to the tree
		var currentNode = new TreeNode('root', 0);
		var rootNode = currentNode;
		
		for (var idx = 0; idx < stream.length; idx++) {
			var nextNode = new TreeNode(stream[idx], stream[idx].level);
			
			if (currentNode.level < nextNode.level) {
				currentNode.addChild(nextNode);
			}
			else if (currentNode.level == nextNode.level) {
				currentNode.parentNode.addChild(nextNode);//add to parent
			}
			else if (currentNode.level > nextNode.level) {
				var appropriateParent = currentNode.getParentOfLevel(nextNode.level);//look for the parent with the same level
				appropriateParent.addChild(nextNode);
			}
			currentNode = nextNode;
		}
		
		// Get the Tree as a JSON object
		var jsonObjectTree = JSON.parse( rootNode.getTreeAsStoreDef() );
		
		return jsonObjectTree;
	}
	
	return {
		getTreeAsJson : getTreeAsJson
	};
})();