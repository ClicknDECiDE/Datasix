/** Version 20130903@0245 F2 **/
/*- CnD Version base 13.0.4960 -*/

var datasix = (datasix || {});

datasix.visualization = (function(visualization)
{
  "use strict";
	
	
	 
  /**
   * @name datasix.visualization.ChartWrapper
   * @class ChartWrapper
   * @param {object} [opt_spec] Either a JSON object defining the chart, or a serialized string version of that object. The format of this object is shown in the drawChart() documentation. If not specified, you must set all the appropriate properties using the set... methods exposed by this object.
   * @example https://developers.google.com/chart/interactive/docs/reference#chartwrapperobject
   */
  visualization.ChartWrapper = function(opt_spec)
  {
    this.status = {none: 'none', loading: 'loading', ready: 'ready'};
    
    var m_options = {};
    var m_containerId;
    var m_chartType;
    var m_dataTable;
    var m_chart = null;
    var m_iParamValues;    
    var m_status = (google.maps === undefined) ? this.status.none : this.status.ready;

   /* DATASIX.Dev -- DEBUG */
    var m_debug = false;

   /** 
    * @name setStatus
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @param {visualization.ChartWrapper.status} status
    */
    this.setStatus = function(status) 
    {
      //console.log("status: " + m_status);    
      m_status = status;
    }

   /** 
    * @name isStatus
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @param {visualization.ChartWrapper.status} status
    */
    this.isStatus = function(status) 
    {
      return (m_status === status);
    }
    
   /** 
    * @name getOptions
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description Returns the options object for this chart.
    * @returns {object}
    */
    this.getOptions = function() 
    {
      return (m_options || {});
    }

   /** 
    * @name getOption
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description Returns the specified chart option value
    * @param {string} key  The name of the option to retrieve. May be a qualified name, such as 'vAxis.title'.
    * @param {string} [opt_default_val]  If the specified value is undefined or null, this value will be returned.
    * @returns {Any type}
    */
    this.getOption = function(key, opt_default_val) 
    {
      var options = this.getOptions();
      if (options[key] === undefined)
        return opt_default_val;
      return options[key];
    }


   /** 
    * @name setOptions
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description Sets a complete options object for a chart.
    * @param {object} options_obj
    */
    this.setOptions = function(options_obj) 
    {
      m_options = options_obj;

      m_options = cnd.ebis.object.clone(options_obj);
      if (m_options.center !== undefined)
        this.setOption('center', m_options.center);
     
      /* -- CND.Dev :: begin --*/
      if (m_options.mapTypeId !== undefined)
        this.setOption('mapTypeId', m_options.mapTypeId);
      /* -- CND.Dev :: end --*/

      if (m_options.dataFormat === undefined)
        m_options.dataFormat = 'default';
     
      if (m_chart !== null)
        this.draw();
    }

   /** 
    * @name setOption
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description Sets a single chart option value, where key is the option name and value is the value. To unset an option, pass in null for the value. Note that key may be a qualified name, such as 'vAxis.title'.
    * @param {string} key
    * @param {string} value
    */
    this.setOption = function(key, value) 
    {
      if (m_options === undefined)
        m_options = {};
      
      switch(key)
      {
        case 'center':
          /* --- DATASIX.Dev : begin --- */
          //this.logDebug ("ebis.maps-min.js - this.setOption :: LatLng??");
          /* --- DATASIX.Dev : end --- */
          if (value instanceof google.maps.LatLng)
            m_options.center = value;
          else
            //m_options.center = new google.maps.LatLng(value.jb, value.kb);
            m_options.center = new google.maps.LatLng(value.ob, value.pb);
          break;
        /* -- CND.Dev :: begin --*/
        case 'mapTypeId':
          m_options.mapTypeId = google.maps.MapTypeId[value] ? google.maps.MapTypeId[value] : value;
          break;
        /* -- CND.Dev :: end --*/        
        default:
          m_options[key] = value;
      }
      
      if (m_chart !== null)
        this.draw();
    }

		/** 
    * @name clone
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description Returns a deep copy of the chart wrapper
    * @returns {datasix.visualization.ChartWrapper}
    */
    this.clone = function() 
    {
			var opt_spec = JSON.parse(this.toJSON());
			return new datasix.visualization.ChartWrapper(opt_spec);
    }
		
    /** 
     * @name getPropertiesInfos
     * @methodOf datasix.visualization.ChartWrapper.prototype
     * @description Returns properties description
     * @returns {object}
     */
    this.getPropertiesInfos = function() 
    {
      var propInfos = 
      {
        /*showMarker:
        {
          CnD:1, 
          type: 'boolean', 
          display: 'show Marker'
        },
        
        showCircleChart:
        {
          CnD:1, 
          type: 'boolean', 
          display: 'show CircleChart'
        },*/
        
        strokeColor:
        {
          CnD:1, 
          type: 'color', 
          display: 'stroke Color'
        },
        
        fillOpacity:
        {
          CnD:1, 
          type: 'number', 
          display: 'fill Opacity'
        },
        
        fillColorMin:
        {
          CnD:1, 
          type: 'color', 
          display: 'fill ColorMin'
        },
        
        fillColorMed:
        {
          CnD:1, 
          type: 'color', 
          display: 'fill ColorMed'
        },
        
        fillColorMax:
        {
          CnD:1, 
          type: 'color', 
          display: 'fill ColorMax'
        },
        /*- DATASIX.Dev -*/
        proportional: //display or not proportional circles using theirs values
        {
          CnD:1, 
          type: 'boolean', 
          display: 'proportional Circles'
        }

      };
      
      return propInfos;
    }
    
    /** 
     * @name setIParamValues
     * @methodOf datasix.visualization.ChartWrapper.prototype
     * @description Sets object used to access parameter values
     * @param {cnd.ebis.IParamValues} An instance of an object implementing the IParamValues interface
     */
    this.setIParamValues = function(iParamValues) 
    { 
      m_iParamValues = iParamValues; 
      if ((m_chart !== null) && (m_chart.setIParamValues !== undefined))
        m_chart.setIParamValues(m_iParamValues);
    }

   /** 
    * @name getContainerId
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @returns {string} The ID of the chart's DOM container element. 
    */
    this.getContainerId = function() {return m_containerId;}

   /** 
    * @name getDataTable
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @returns {google.visualization.DataTable} 
    */
    this.getDataTable = function() 
    {
      return m_dataTable;
    }

   /** 
    * @name getChartType
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @returns {string} The class name of the wrapped chart. If this is a Datasix chart, the name will not be qualified with datasix.visualization. So, for example, if this were a Map chart, it would return "Map" rather than "datasix.visualization.Map".
    */
    this.getChartType = function() 
    {
      return m_chartType;
    }
    
   /** 
    * @name getChart
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description Returns a reference to the chart created by this ChartWrapper, for example a google.visualization.BarChart or a google.visualization.ColumnChart. This will return null until after you have called draw() on the ChartWrapper object, and it throws a ready event. Methods called on the returned object will be reflected on the page.
    * @returns {Chart object reference} 
    */
    this.getChart = function() {return m_chart;}

    
   /** 
    * @name draw
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description Draws the chart. You must call this method after any changes that you make to the chart or data to show the changes.
    * @param {object} [opt_container_ref]  A reference to a valid container element on the page. If specified, the chart will be drawn there. If not, the chart will be drawn in the element with ID specified by containerId.
    * @returns {Chart object reference} 
    */
    this.draw = function(opt_container_ref)
    {
      /* -- CND.Dev :: begin --*/
      var thisWrapper = this;

      function m_internalDraw() 
      {
        /* <-- datsix.dev : begin --> */
        //this.logDebug ('datasix.visualization.ChartWrapper.thisWrapper.draw: '+m_chart);
        /* <-- datsix.dev : end --> */
        if (m_chart === null)
        {
          var container = (opt_container_ref || $(thisWrapper.getContainerId()));
          m_chart = new datasix.visualization[thisWrapper.getChartType()](container);
          if (m_chart.setIParamValues !== undefined)
            m_chart.setIParamValues(m_iParamValues);
          
          // Listeners...
          $(m_chart).on('ready', function(event){thisWrapper.fireReady();});
          $(m_chart).on('select', function(event){thisWrapper.fireSelect();});
          /* <-- datasix.dev : begin --> [inDevelopment...] */
          //$(m_chart).on('resize', function(event){thisWrapper.fireResize();});
          /* <-- datasix.dev : end  --> */
        }

        m_chart.draw(thisWrapper.getDataTable(), thisWrapper.getOptions());
      };
      
      if (!google.maps && this.isStatus(this.status.none))
      {
        // Loading Google Maps V3...
        this.setStatus(this.status.loading);
        
        datasix.visualization.loadingCallback = function() 
        {
          datasix.visualization.loadingCallback = undefined;
          thisWrapper.setOptions(m_options);
          m_internalDraw();
        };
        
        $.ajax
        (
          'http://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false&callback=datasix.visualization.loadingCallback', 
          {
            cache: true,
            dataType: 'script',
            success: function(data, textStatus, jqxhr) 
            {
              //this.logDebug (data); //data returned
              //this.logDebug (textStatus); //success
              //this.logDebug (jqxhr.status); //200
              //this.logDebug ('Google MapsV3 loaded!');
            }
          }
        );
      }
      else
      {
        if (this.isStatus(this.status.ready))
          m_internalDraw();
      }
      
      /* -- CND.Dev :: end --*/
    }

   /** 
    * @name toJSON
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description Returns a string version of the JSON representation of the chart.
    * @returns {string} 
    */
    this.toJSON = function() 
    {
      var opt_spec = 
      {
        containerId: this.getContainerId(),
        chartType: this.getChartType(),
        dataTable: this.getDataTable(),
        options: this.getOptions()
      };
      
      return JSON.stringify(opt_spec);
    }

    /** 
    * @event
    * @name fireReady
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description The chart is ready for external method calls. If you want to interact with the chart, and call methods after you draw it, you should set up a listener for this event before you call the draw method, and call them only after the event was fired.
    */
    this.fireReady = function()
    {
      this.setStatus(this.status.ready);
      $(this).trigger ('ready');
    }
    
   /** 
    * @event
    * @name fireSelect
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description Fired when the user clicks a visual entity. To learn what has been selected, call getSelection().
    */
    this.fireSelect = function()
    {
      $(this).trigger ('select');
    }
    
    /** 
    * @event
    * @name fireResize
    * @methodOf datasix.visualization.ChartWrapper.prototype
    * @description [datasix.dev] Fires when change the size of control (Map) / Se lanza cuando cambia el tamaño del control (Mapa)
    */
    this.fireResize = function()
    {
    }

   /*
    * @function
    * @name this.logDebug
    * @description If m_debug it's true, it shows information of debug in Browser LOG 
    */
    this.logDebug = function(txt) {
      if (m_debug) {
        console.log (txt);
      }
    }


   /**
    * Initialisation
    */
    if (opt_spec !== undefined)
    {
      m_containerId = opt_spec.containerId;
      m_chartType = opt_spec.chartType;
      
      if (opt_spec.dataTable instanceof Array)
        m_dataTable = google.visualization.arrayToDataTable(opt_spec.dataTable);
      else
      if (typeof opt_spec.dataTable === 'string')
        m_dataTable = new google.visualization.DataTable(JSON.parse(opt_spec.dataTable));
      else
      if (typeof opt_spec.dataTable === 'object')
        m_dataTable = new google.visualization.DataTable(opt_spec.dataTable);
      else
      if (opt_spec.dataTable instanceof google.visualization.DataTable)
        m_dataTable = opt_spec.dataTable;
        /* -- CND.Dev :: begin --*/
        // Loading Google Maps V3...
        if (!google.maps)
        {
          m_options = opt_spec.options;
        }
        else
        {
          this.setOptions(opt_spec.options);
        }
        /* -- CND.Dev :: end --*/
        /* default advanced options for Circle Chart :: begin */
        //if (m_options.showMarker === undefined) m_options.showMarker=true; 
        //if (m_options.showCircleChart === undefined) m_options.showCircleChart=true; 
        if (m_options.strokeColor === undefined) m_options.strokeColor='transparent';
        if (m_options.fillOpacity === undefined) m_options.fillOpacity=100; //internally is divided by 100 to obtain value between 0 and 1
        if (m_options.fillColorMin === undefined) m_options.fillColorMin='#FF0000'; // Red
        if (m_options.fillColorMed === undefined) m_options.fillColorMed='#FFFF00'; // Yellow
        if (m_options.fillColorMax === undefined) m_options.fillColorMax='#008000'; // Green
        if (m_options.proportional === undefined) m_options.proportional=true; //size of circles changes in relation to values
        /* default advanced options for Circle Chart :: end */
    }
  }
  

return visualization;
})(datasix.visualization || {});  

