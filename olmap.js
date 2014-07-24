/** Version 20130903@0245 F2 **/
/*- CnD Version base 13.0.4960 -*/

var datasix = (datasix || {});

datasix.visualization = (function(visualization) 
{
    "use strict";

 
    /**
     * @name datasix.visualization.OLMap
     * @description Map bulid with OpenLayers Library
     * @class OLMap
     * @param {object} container_ref  A reference to a valid container element on the page. The chart will be drawn there.
     */
    visualization.OLMap = function(container_ref) {
        var m_container = container_ref;
        var m_map;
        var m_dataToApply; //

        var m_currentSelection;
        var m_iParamValues;

        /* --- DATASIX.Dev :: begin --- */
        var m_markers = {}; // < --- array of markers of the Map
        var m_circles = {}; // < --- array of circles of the Map    
        var m_timesFlag = 0; // < --- control: how times execute this code?
        /*  setMarkers : params for this function */
        var m_auto_remove = true; // < --- When true, markers for all unreported locs will be removed.
        var m_locations = {}; //< --- A repository for markers and circles (and the data from which they were constructed).
        var m_infowindowArray = new Array; //< --- Array of infowindows

        // DATASIX.Dev -- DEBUG
        var m_debug = false;
        var m_sumRadius = 0; // DEBUG: to check if sum of all radius is equal to the minimum value between Width and Height of the bounds of the selected area
        //
        // DATASIX.Dev.OL
        var m_epsg4326 = new OpenLayers.Projection("EPSG:4326");
        var m_lyrMarkers = new OpenLayers.Layer.Vector("Markers");
        var m_OLBaseLoaded = false;
        //

        this.getMap = function() {
            return m_map;
        }

        /** 
         * @name setIParamValues
         * @methodOf datasix.visualization.OLMap
         * @description Sets object used to access parameter values
         * @param {cnd.ebis.IParamValues} An instance of an object implementing the IParamValues interface
         */
        this.setIParamValues = function(iParamValues) {
            m_iParamValues = iParamValues;
        }

        /** 
         * @name getDataFormatNames
         * @methodOf datasix.visualization.OLMap
         * @returns {array} Data format names
         */
        this.getDataFormatNames = function() {
            var arrayFormatName = [];
            if (datasix.visualization.Map.dataFormat !== undefined) {
                for (var i = 0; i < datasix.visualization.Map.dataFormat.length; i++) {
                    arrayFormatName.push(datasix.visualization.Map.dataFormat[i].name);
                }
            }

            return arrayFormatName;
        }

        /** 
         * @name getDataFormatInfos
         * @methodOf datasix.visualization.OLMap
         * @returns {object} {name: , description: , infos: , markerOptions: , ...}
         */
        this.getDataFormatInfos = function(dataFormatName) {
            if (datasix.visualization.Map.dataFormat !== undefined) {
                for (var i = 0; i < datasix.visualization.Map.dataFormat.length; i++) {
                    if (datasix.visualization.Map.dataFormat[i].name == dataFormatName)
                        return datasix.visualization.Map.dataFormat[i];
                }
            }
        }


        /** 
         * @name createMarker
         * @methodOf datasix.visualization.OLMap
         * @returns {OpenLayers.Marker}
         */
        this.createMarker = function(location, key) {
            var marker;

            if ((location.lat !== undefined) && (location.lng !== undefined)) {
                var markerOptions = {
                    position: new OpenLayers.Geometry.Point(location.lng, location.lat).transform(m_epsg4326, m_map.getProjectionObject()),
                    map: m_map,
                };

                for (var elt in location) {
                    switch (elt) {
                        case 'lat':
                        case 'lng':
                        case 'marker':
                            break;

                        default:
                            markerOptions[elt] = location[elt];
                    }
                }

                /*if (location.icon && location.icon !== "default") 
        {
          markerOptions.icon = location.icon;
          if (location.shadow !== undefined)
            markerOptions.shadow = location.shadow;
        }*/

                this.logDebug("location[" + key + "].icon: " + location.icon, true);

                marker = new OpenLayers.Feature.Vector(markerOptions.position, {
                    externalGraphic: location.icon
                });
            }

            return marker;
        }

        /** 
         * @name setMarkerClickEvent
         * @methodOf datasix.visualization.OLMap
         */
        this.setMarkerClickEvent = function(key) {
            var location = m_locations[key];

            //Attach click listener to marker
            if ((location !== undefined) && (location.marker !== undefined) && (location.info !== undefined)) {
                var $this = this;
                google.maps.event.addListener(location.marker, 'click', (function(key) {
                    return function() {
                        closeAllInfoWindows();
                        var infowindow = new google.maps.InfoWindow({
                            content: location.info
                        });
                        //add to m_infowindowArray to can close it later
                        m_infowindowArray.push(infowindow);
                        //open it
                        infowindow.open(m_map, m_locations[key].marker);
                        // I put column to 0 but it's my choice. It's if user choose to retrieve selection with col = -1
                        m_currentSelection = {
                            row: parseInt(key),
                            column: 0
                        };

                        $this.fireSelect();
                    }
                })(key));
            }
        }




        /**
     * @name setMarkers
     * @methodOf datasix.visualization.OLMap
     * @description @link <a href="http://stackoverflow.com/questions/14771422/google-map-v3-auto-refresh-markers-only">Google Map v3 Auto Refresh Markers Only</a>
     *              Basis code with plus development by DATASIX.
     * @param {object} LocOBJ: JSON with this structure:
      var locs = {
        "1": { "info":"11111. Some random info here", "lat":-37.8139, "lng":144.9634, "icon":"default" },
        "2": { "info":"22222. Some random info here", "lat":46.0553, "lng":14.5144, "icon":"police.png" },
        "3": { "info":"33333. Some random info here", "lat":-33.7333, "lng":151.0833, "icon":"school.png" },
        "4": { "info":"44444. Some random info here", "lat":27.9798, "lng":-81.731, "icon":"pharmacy.png" }
      };
      -- or --
      var testLocs = {
        "1": { "info":"1. New Random info and new position", "lat":-37, "lng":124.9634 },//update info and position and 
        "2": { "lat":70, "lng":14.5144 },//update position
        "3": { "info":"3. New Random info" },//update info
        "4": { "remove": true },//remove marker
        "5": { "info":"55555. Added", "lat":-37, "lng":0 }//add new marker
      };      
    */
        this.setMarkers = function(locObj) {
            // DATASIX.Dev.OL >> Review
            //var ltLngBounds = new google.maps.LatLngBounds();
            //close all infowindows when markers change
            closeAllInfoWindows();

            // DATASIX.Dev.OL >> Review
            /*
            if (m_auto_remove) {
                //Remove markers for all unreported locs, and the corrsponding m_locations entry.
                $.each(m_locations, function(key) {
                    if (m_locations[key].marker) {
                        m_locations[key].marker.setMap(null);
                    }
                    if (!locObj[key]) {
                        delete m_locations[key];
                    }
                });
            }
            */

            var $this = this;
            // DATASIX.Dev.OL
            console.log("addLayer m_lyrMarkers");
            console.log("m_lyrMarkers: ");
            console.dir(m_lyrMarkers);
            m_map.addLayer(m_lyrMarkers);
            //
            $.each(locObj, function(key, loc) {
                if (!m_locations[key] && (loc.lat !== undefined) && (loc.lng !== undefined)) {
                    //Marker has not yet been made (and there's enough data to create one).
                    loc.marker = $this.createMarker(loc, key);
                    console.dir("loc.marker[" + key + "]: ");
                    console.dir(loc.marker);
                    //Remember loc in the `m_locations` so its info can be displayed and so its marker can be deleted.
                    m_locations[key] = loc;
                    //
                    m_lyrMarkers.addFeatures(loc.marker);
                    // DATASIX.Dev.OL >> Review
                    //$this.setMarkerClickEvent(key);
                } else
                if (m_locations[key] && loc.remove) {
                    //Remove marker from map
                    if (m_locations[key].marker) {

                        m_lyrMarkers.removeFeatures(m_locations[key].marker);
                    }
                    // Remove element from` m_locations`
                    delete m_locations[key];
                } else
                if (m_locations[key]) {
                    //Update the previous data object with the latest data.
                    $.extend(m_locations[key], loc);
                    if ((loc.lat !== undefined) && (loc.lng !== undefined)) {
                        //Update marker position (maybe not necessary but doesn't hurt).
                        m_locations[key].marker = $this.createMarker(loc, key);
                        // DATASIX.Dev.OL >> Review
                        //$this.setMarkerClickEvent(key);
                    }

                    //m_locations[key].info looks after itself.
                }
            });


            // DATASIX.Dev.OL >> Review :: begin 
            /*
            // < --- Calculate Bounds of the markers for fitBounds (adjust to see appropiated Zoom if there are a few markers)
            $.each(m_locations, function(key, loc) {
                ltLngBounds.extend(new google.maps.LatLng(m_locations[key].lat, m_locations[key].lng));
            });

            // Don't zoom in too far on only one marker
            if (ltLngBounds.getNorthEast().equals(ltLngBounds.getSouthWest())) {
                var extendPoint1 = new google.maps.LatLng(ltLngBounds.getNorthEast().lat() + 0.001, ltLngBounds.getNorthEast().lng() + 0.001);
                var extendPoint2 = new google.maps.LatLng(ltLngBounds.getNorthEast().lat() - 0.001, ltLngBounds.getNorthEast().lng() - 0.001);
                ltLngBounds.extend(extendPoint1);
                ltLngBounds.extend(extendPoint2);
            }

            m_map.fitBounds(ltLngBounds);
            */
            // // DATASIX.Dev.OL >> Review :: end
        }


        /** 
         * @name calcRadius
         * @description calculate radius of the circle proportionally to all values of de selected area
         * @param {float} total SUM de all values of the selected area
         * @param {float} dKm distance in Km of the minimum value bewteen Width and Height of the viewport
         * @param {float} value value of the point of the selected area
         * @returns {Number} radius calculated en meters
         */
        function calcRadius(total, dKm, value) {
            var cRadius = (Math.abs((value * dKm / total)) * 1000) / 2
            //this.logDebug ('cRadius = ' + cRadius + ' = ABS( (' + value + ' * ' + dKm + ' / ' + total + ') ) * 1000');

            return (cRadius);

        }

        /** 
         * @name getMetersPerPixel
         * @param {Object} opt optional parameters
         *      - zoom
         *      - lat
         * @returns {Number} scale in meters per pixel
         */
        function getMetersPerPixel(opt) {
            return (Math.cos(parseFloat(opt.lat)) * (1 / Math.pow(2, parseFloat(opt.zoom) + 8)) * 40075017); // Equatorial circumference in meters: 40,075,017
        }

        /**
         * Computes scale in meters per pixel for given zoom and latitute.
         * @param {Object} opt optional parameters
         *      - zoom
         *      - lat
         *      - precision
         * @returns {Number} scale in meters per pixel
         */
        function getMapScale(opt) {
            var circumference = 40075017,
                zoom, lat, scale;

            if (typeof(opt.zoom) == 'number' && typeof(opt.lat) == 'number') {
                zoom = opt.zoom;
                lat = opt.lat;
            } else {
                zoom = m_map.getZoom();
                lat = m_map.getCenter().lat();
            }

            scale = (circumference * Math.cos(lat) / Math.pow(2, zoom + 8));

            if (typeof(opt.precision) == 'number') {
                scale = Number(scale.toFixed(opt.precision));
            }

            return scale;
        }

        // DATASIX.Dev :: Begin :: calculate color Gradient

        /*
         * @name hexdec
         * @description convert hexadecimal in decimal
         * @param {string} hex_string
         * @return {integer}
         */
        function hexdec(hex_string) {
            hex_string = (hex_string + '').replace(/[^a-f0-9]/gi, '');
            return parseInt(hex_string, 16);
        }

        /*
         * @name dechex
         * @description convert decimal in hexadecimal
         * @param {integer} number
         * @return {string}
         */
        function dechex(number) {
            if (number < 0) {
                number = 0xFFFFFFFF + number + 1;
            }
            return parseInt(number, 10).toString(16);
        }

        /*
         * @name pad
         * @description fill with 0s on the left until the lenght
         * @param {integer} number
         * @param {integer} length
         * @return {string}
         */
        function pad(number, length) {
            var str = '' + number;
            while (str.length < length) {
                str = '0' + str;
            }
            return str;
        }

        /*
         * @name calcGradient
         * @description calculate gradient color using one color, between two or between three
         * @param {object} valOpts
         *    valOpts = { "value": *num*, "sum": *num*, "avg": *num*, "min": *num*, "max": *num* }
         * @param {object} colOpts
         *    colOpts = { "stroke": *hexColor*", "min": *hexColor*", "med": *hexColor*", "max": *hexColor*" }
         * @return {string}
         */
        function calcGradient(valOpts, colOpts) {
            var v = 0;
            var vMin = 0;
            var vMax = 0;
            var vAvg = 0;
            // If only colorMin is defined...
            if ((colOpts.med == "none" || colOpts.med == "") && (colOpts.max == "none" || colOpts.max == "")) {
                //var per = parseFloat(valOpts.value) / parseFloat(valOpts.total);
                return colOpts.min;
            }

            if (colOpts.value == undefined) {
                v = valOpts.value;
                vMin = valOpts.min;
                vMax = valOpts.max;
                vAvg = valOpts.avg;
            } else {
                v = colOpts.value;
                vMin = colOpts.minValue;
                vMax = colOpts.maxValue;
                vAvg = colOpts.avgValue;
            }

            var per = (v - vMin) / (vMax - vMin);
            //If there is only one value...
            if (isNaN(per)) return colOpts.max;
            // If there is two colors defined...
            if (colOpts.med == "none") {
                return calcGradientTwoColors(colOpts.min, colOpts.max, per);
            } else {
                //if are defined all of three (min, med, max) ...
                if (v < vAvg) {
                    var colMin = colOpts.min;
                    var colMax = colOpts.med;
                } else {
                    var colMin = colOpts.med;
                    var colMax = colOpts.max;
                }
                return calcGradientTwoColors(colMin, colMax, per);
            }
        }

        /*
         * @name calcGradientTwoColors
         * @description calculate gradient color using two colors and apply percentage
         * @param {string} min color from
         * @param {string} max color to
         * @param {float} per
         * @return {string}
         */
        function calcGradientTwoColors(min, max, per) {
            var minR = hexToR(min);
            var minG = hexToG(min);
            var minB = hexToB(min);
            var maxR = hexToR(max);
            var maxG = hexToG(max);
            var maxB = hexToB(max);
            var colR = parseInt(minR + (maxR - minR) * per);
            var colG = parseInt(minG + (maxG - minG) * per);
            var colB = parseInt(minB + (maxB - minB) * per);
            return rgbToHex(colR, colG, colB);
        }


        function ______calcGradient(val, color1, color2, color3) {

            if (!color1.match(/^#[0-9a-f]{6}/) || !color2.match(/^#[0-9a-f]{6}/)) return 'match err!';

            if (val > 1) {
                val = 1;
            }
            if (val < 0) {
                val = 0;
            }
            val = parseFloat(val);

            c1 = [Color.hexdec(color1.substr(1, 2)), Color.hexdec(color1.substr(3, 2)), Color.hexdec(color1.substr(5, 2))];
            c2 = [Color.hexdec(color2.substr(1, 2)), Color.hexdec(color2.substr(3, 2)), Color.hexdec(color2.substr(5, 2))];

            if (val < .5) {
                delta = [(c2[0] - c1[0]), (c2[1] - c1[1]), (c1[2] - c2[2])];
                arrColor = [c1[0] - ((delta[0] * val) * 2), c1[1] + ((delta[1] * val) * 2), c1[2] - ((delta[2] * val) * 2)];
            } else {
                delta = [(c1[0] - c2[0]), (c1[1] - c2[1]), (c1[2] - c2[2])];
                arrColor = [c1[0] - (delta[0] * (val - .5) * 2), c1[1] - (delta[1] * (val - .5) * 2), c1[2] - (delta[2] * (val - .5) * 2)];
            }
            return '#' + Color.pad(Color.dechex(arrColor[0]), 2) + Color.pad(Color.dechex(arrColor[1]), 2) + Color.pad(Color.dechex(arrColor[2]), 2);
        }

        // DATASIX.Dev :: convert RGB to hex

        function componentToHex(c) {
            var hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        }

        function rgbToHex(r, g, b) {
            return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
        }

        // DATASIX.Dev :: convert hex to RGB

        /*
         * @name hexToR
         * @description Color value in Hexadecimal to RGB (only Red part)
         * @param {string} h
         * @return {integer} Part R of RGB color
         */
        function hexToR(h) {
            return parseInt((cutHex(h)).substring(0, 2), 16)
        }

        /*
         * @name hexToG
         * @description Color value in Hexadecimal to RGB (only Green part)
         * @param {string} h
         * @return {integer} Part G of RGB color
         */
        function hexToG(h) {
            return parseInt((cutHex(h)).substring(2, 4), 16)
        }

        /*
         * @name hexToB
         * @description Color value in Hexadecimal to RGB (only Blue part)
         * @param {string} h
         * @return {integer} Part B of RGB color
         */
        function hexToB(h) {
            return parseInt((cutHex(h)).substring(4, 6), 16)
        }

        /*
         * @name cutHex
         * @description Delete # symbol of Hex Color
         * @param {string} h
         * @return {integer} Hex color without # symbol
         */
        function cutHex(h) {
            return (h.charAt(0) == "#") ? h.substring(1, 7) : h
        }

        // DATASIX.Dev :: End :: calculate color Gradient

        /** 
         * @name createCircle
         * @param {object} Location: information about point
         * @param {Int} key: position inside array
         * @param {Float} total: sum of all values from the selected area
         * @param {Float} dKm: distance in Km of Bounds for the selected area
         * @methodOf datasix.visualization.OLMap
         * @returns {google.maps.Circle}
         */
        this.createCircle = function(location, key, valOpts, colOpts, dKm) {
            // valOpts = {"value": *num*, sum": *num*, "avg": *num*, "min": *num*, "max": *num* }
            // colOpts = { "stroke": "*hexColor*", "min": "*hexColor*", "med": "*hexColor*", "max": "*hexColor*" }

            var circle;
            valOpts.value = location.value;
            colOpts.value = location.valueColor;


            if ((location.lat !== undefined) && (location.lng !== undefined)) {
                var circleOptions = {
                    center: new google.maps.LatLng(location.lat, location.lng),
                    map: m_map,
                };

                var bProportional = (location.proportional == "true" || location.proportional);
                for (var elt in location) {
                    switch (elt) {
                        case 'lat':
                        case 'lng':
                        case 'proportional':
                            break;
                        case 'value':
                        case 'radius':
                            //circleOptions['radius'] = parseInt(location['value']/total*10000); //radius: measured in meters
                            if (!bProportional) {
                                circleOptions.radius = calcRadius(valOpts.sum, dKm, valOpts.avg);
                            } else {
                                circleOptions.radius = calcRadius(valOpts.sum, dKm, location.value);
                            }
                            // -- DATASIX.Dev : debug                
                            m_sumRadius += circleOptions.radius;

                            break;
                        case 'strokeColor':
                        case 'fillColor':
                        case 'fillColorMin':
                        case 'fillColorMed':
                        case 'fillColorMax':
                            circleOptions.fillColor = calcGradient(valOpts, colOpts); //calcGradient (0.5, location['fillColorMin'], location['fillColorMed'], location['fillColorMax']);
                            if (colOpts.stroke == 'transparent' || colOpts.stroke == '') {
                                circleOptions.strokeOpacity = 0.00001;
                                circleOptions.strokeWeight = 0;
                            } else {
                                circleOptions.strokeColor = colOpts.stroke;
                            }
                            break;
                        default:
                            circleOptions[elt] = location[elt];
                    }
                }

                // clickable option: disabled
                circleOptions.clickable = false;

                circle = new google.maps.Circle(circleOptions);
            }

            return circle;
        }

        /** 
         * @name setCircleClickEvent
         * @methodOf datasix.visualization.OLMap
         */
        this.setCircleClickEvent = function(key) {
            /* <--------------------------- standBy...
       var location = m_locations[key];
       
       //Attach click listener to circle
       if ((location !== undefined) && (location.marker !== undefined) && (location.info !== undefined))
       {
         var $this = this;
         google.maps.event.addListener(location.circle, 'click', (function(key) 
         {
           return function() 
           {
             closeAllInfoWindows();
             var infowindow = new google.maps.InfoWindow({content: location.info});
             //add to m_infowindowArray to can close it later
             m_infowindowArray.push(infowindow);
             //open it
             infowindow.open(m_map, m_locations[key].circle);
             // I put column to 0 but it's my choice. It's if user choose to retrieve selection with col = -1
             m_currentSelection = {row: parseInt(key), column: 0}; 
             $this.fireSelect();
           }
         })(key));
       }
       */
        }


        /**
         * @name setCircles
         * @methodOf datasix.visualization.OLMap
         * @description To draw circles where each one represents ratio over all circles in the viewport using its radius
         * @param {object} LocOBJ: attributes of the circles
         */
        this.setCircles = function(locObj, colOpts) {
            var ltLngBounds = new google.maps.LatLngBounds();
            var sumTotal = 0;
            var sumTotalColor = 0; //If there is defined locObj.valueColor
            var minVal = 0;
            var minValColor = 0; //If there is defined locObj.valueColor
            var maxVal = 0;
            var maxValColor = 0; //If there is defined locObj.valueColor
            var avgVal = 0;
            var avgValColor = 0; //If there is defined locObj.valueColor
            var nVal = 0;
            //close all infowindows when markers change
            //closeAllInfoWindows();

            // DATASIX.Dev -- Debug
            m_sumRadius = 0


            /*if (cnd.ebis.html.isModeEdit()) 
       {
          return 0;
       }*/

            if (locObj.length == 0) {
                this.setError("There isn't values to draw Circles");
                this.fireReady();
                return;
            }

            try {
                $.each(locObj, function(key, loc) {
                    //this.logDebug ("loc.value: " + loc.value);
                    nVal = parseFloat(loc.value);
                    sumTotal += nVal;
                    if (key == 0) {
                        minVal = nVal;
                        maxVal = nVal;
                    } else {
                        if (nVal < minVal) minVal = nVal;
                        if (nVal > maxVal) maxVal = nVal;
                    }
                    //If there is defined value to manage gradient...
                    if (loc.valueColor != undefined) {
                        nVal = parseFloat(loc.valueColor);
                        sumTotalColor += nVal;
                        if (key == 0) {
                            minValColor = nVal;
                            maxValColor = nVal;
                        } else {
                            if (nVal < minValColor) minValColor = nVal;
                            if (nVal > maxValColor) maxValColor = nVal;
                        }
                    }
                });
                if ((sumTotal == 0) || (isNaN(sumTotal))) {
                    this.setError("There isn't values to draw");
                    return -1;
                }
                avgVal = sumTotal / locObj.length;
                avgValColor = sumTotalColor / locObj.length;
                this.logDebug("setCircles > sumTotal: " + sumTotal);
                this.logDebug("setCircles > minVal: " + minVal);
                this.logDebug("setCircles > maxVal: " + maxVal);
                this.logDebug("setCircles > avgVal: " + avgVal);
                this.logDebug("setCircles > sumTotalColor: " + sumTotalColor);
                this.logDebug("setCircles > minValColor: " + minValColor);
                this.logDebug("setCircles > maxValColor: " + maxValColor);
                this.logDebug("setCircles > avgValColor: " + avgValColor);
                var valOpts = {
                    "sum": sumTotal,
                    "avg": avgVal,
                    "min": minVal,
                    "max": maxVal
                }

                colOpts.sumValue = sumTotalColor;
                colOpts.minValue = minValColor;
                colOpts.maxValue = maxValColor;
                colOpts.avgValue = avgValColor;
                //
            } catch (e) {
                throw ("Error loading values for Circles: " + e);
            }

            if (m_auto_remove) {
                //Remove markers for all unreported locs, and the corrsponding m_locations entry.
                $.each(m_circles, function(key) {
                    if (m_circles[key]) {
                        m_circles[key].setMap(null);
                    }
                    if (!locObj[key]) {
                        delete m_circles[key];
                    }
                });
            }

            // < --- Calculate Bounds of the points for fitBounds (adjust to see appropiated Zoom if there are a few circles)
            $.each(locObj, function(key, loc) {
                ltLngBounds.extend(new google.maps.LatLng(loc.lat, loc.lng));
            });

            // Don't zoom in too far on only one marker
            if (ltLngBounds.getNorthEast().equals(ltLngBounds.getSouthWest())) {
                var extendPoint1 = new google.maps.LatLng(ltLngBounds.getNorthEast().lat() + 0.001, ltLngBounds.getNorthEast().lng() + 0.001);
                var extendPoint2 = new google.maps.LatLng(ltLngBounds.getNorthEast().lat() - 0.001, ltLngBounds.getNorthEast().lng() - 0.001);
                ltLngBounds.extend(extendPoint1);
                ltLngBounds.extend(extendPoint2);
            }

            m_map.fitBounds(ltLngBounds);


            /* 
        Calculate minimum diameter in Km to create circles sizes proportionally to values 
        Uses this when only have one color defined in options 
       */
            var mapViewport = m_map.getBounds();
            // distance in Km for width
            var dKmW = getDistanceFromLatLonInKm(mapViewport.getNorthEast().lat(), mapViewport.getNorthEast().lng(), mapViewport.getNorthEast().lat(), mapViewport.getSouthWest().lng());
            // distance in Km for height
            var dKmH = getDistanceFromLatLonInKm(mapViewport.getSouthWest().lat(), mapViewport.getSouthWest().lng(), mapViewport.getNorthEast().lat(), mapViewport.getSouthWest().lng());
            // get the minimun value of both
            var dKmMin = Math.min(dKmW, dKmH); //(dKmW < dKmH) ? dKmW : dKmH;
            /* --- */

            var $this = this;
            $.each(locObj, function(key, loc) {
                if (!m_circles[key] && (loc.lat !== undefined) && (loc.lng !== undefined)) {
                    //Marker has not yet been made (and there's enough data to create one).
                    loc = $this.createCircle(loc, key, valOpts, colOpts, dKmMin);
                    //Remember loc in the `m_locations` so its info can be displayed and so its marker can be deleted.
                    m_circles[key] = loc;
                    $this.setCircleClickEvent(key);
                } else
                if (m_circles[key] && loc.remove) {
                    //Remove circle from map
                    if (m_circles[key]) {
                        m_circles[key].setMap(null);
                    }
                    //Remove element from `m_locations`
                    delete m_circles[key];
                } else
                if (m_circles[key]) {
                    //Update the previous data object with the latest data.
                    $.extend(m_circles[key], loc);
                    if ((loc.lat !== undefined) && (loc.lng !== undefined)) {
                        //Update marker position (maybe not necessary but doesn't hurt).
                        m_circles[key] = $this.createCircle(loc, key, valOpts, colOpts, dKmMin);
                        $this.setCircleClickEvent(key);
                    }

                }
            });

            var circlesBounds = new google.maps.LatLngBounds();
            // < --- Calculate Bounds of the circles for fitBounds (adjust to see appropiated Zoom if there are a few circles)
            $.each(m_circles, function(key, loc) {
                var extPnt1 = new google.maps.LatLng(loc.getBounds().getNorthEast().lat(), loc.getBounds().getNorthEast().lng());
                var extPnt2 = new google.maps.LatLng(loc.getBounds().getSouthWest().lat(), loc.getBounds().getSouthWest().lng());
                circlesBounds.extend(extPnt1);
                circlesBounds.extend(extPnt2);
            });

            m_map.fitBounds(circlesBounds);
            // DATASIX.Dev -- Debug
            this.logDebug('dKmMin: ' + dKmMin + ' / m_sumRadius (Km): ' + m_sumRadius / 1000);
        }

        // For calculate distance between two points of the map
        function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
            var R = 6371; // Radius of the earth in km
            var dLat = deg2rad(lat2 - lat1); // deg2rad below
            var dLon = deg2rad(lon2 - lon1);
            var a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            var d = R * c; // Distance in km
            return d;
        }

        function deg2rad(deg) {
            return deg * (Math.PI / 180)
        }


        /* --- DATASIX.Dev :: end --- */

        /** 
         * @name getContainer
         * @methodOf datasix.visualization.OLMap.prototype
         * @returns {object}
         */
        this.getContainer = function() {
            return m_container;
        }

        /** 
         * @name getGeocode
         * @methodOf datasix.visualization.OLMap
         * @description @link  <a href="https://developers.google.com/maps/documentation/geocoding/index#GeocodingRequests" />Google documentation</a>
         * @param {string} address The address that you want to geocode.
         * @param {boolean} sensor Indicates whether or not the geocoding request comes from a device with a location sensor. This value must be either true or false.
         * @param {function} callback callback(object)
         */
        function getGeocode(address, sensor, callback) {
            var url = "http://maps.googleapis.com/maps/api/geocode/json" +
                "?address=" + encodeURIComponent(address) +
                "&sensor=" + sensor;
            $.ajax(
                url, {
                    async: false,
                    dataType: 'json',
                    data: {
                        dataType: 'json'
                    },
                    success: function(response) {
                        if (response.status == "OK") {
                            callback(response.results[0]);
                        } else {
                            var errors = response.errors || [];
                            if (errors.length > 0) {
                                throw (errors[0].message);
                            } else {
                                throw ("Unknown error while retreiving geocode");
                            }
                        }
                    },

                    error: function(jqXHR, status, error) {
                        throw (error.message);
                    }
                }
            );
        }

        /* --- DATASIX.Dev :: begin --- */
        /** 
         * @name closeAllInfoWindows
         * @methodOf datasix.visualization.OLMap
         * @description close all infowindows
         */
        function closeAllInfoWindows() {
            var n;
            if (m_infowindowArray) {
                for (n in m_infowindowArray) {
                    m_infowindowArray[n].close();
                }
            }
            m_currentSelection = undefined;
        }

        /** 
         * @name isNumber
         * @methodOf datasix.visualization.OLMap
         * @description check if value is numeric or not (returns true or false)
         * @param {string} value.
         */
        function isNumber(n) {
            return !isNaN(parseFloat(n)) && isFinite(n);
        }

        /** 
         * @name getGeocodeOSM
         * @methodOf datasix.visualization.OLMap
         * @description @link  <a href="http://open.mapquestapi.com/nominatim/" />mapquest open - nominatim search service</a>
         * @param {string} address The address that you want to geocode.
         * @param {boolean} [!] sensor Indicates whether or not the geocoding request comes from a device with a location sensor. This value must be either true or false.
         * @param {function} callback callback(object)
         */
        function getGeocodeOSM(address, sensor, callback) {
            // http://stackoverflow.com/questions/9160123/no-transport-error-w-jquery-ajax-call-in-ie
            // --------------------------------------------------------------------------------------
            //if ($.browser && $.browser.msie)
            if (cnd.ebis.navigator.isIE())
                $.support.cors = true;
            // --------------------------------------------------------------------------------------

            var url = "http://open.mapquestapi.com/nominatim/v1/search.php?format=json" +
                "&q=" + encodeURIComponent(address) + "&limit=3"
            $.ajax(
                url, {
                    async: false,
                    dataType: 'json',
                    data: {
                        dataType: 'json'
                    },
                    success: function(response) {
                        if (response.length > 0)
                            callback(response);
                        else
                            throw ("Unknown address: " + address);
                    },

                    error: function(jqXHR, status, error) {
                        if (typeof(error) === 'string')
                            throw (error);
                        else
                            throw (error.message);
                    }
                }
            );
        }

        /* --- DATASIX.Dev :: end --- */


        /** 
         * @name getDataLocalisationType
         * @methodOf datasix.visualization.OLMap.prototype
         * @description Check dataTable structure to define type of localisation
         * @example @link <a href="https://developers.google.com/chart/interactive/docs/gallery/geochart#Data_Format">
         * Marker location [Required]
         * The first column is a specific string address (for example, "1600 Pennsylvania Ave").
         *    OR
         * The first two columns are numeric, where the first column is the latitude, and the second column is the longitude.
         * @param {google.visualization.DataTable} data
         * @returns {string} 'latlng' or 'address' or undefined
         */
        this.getDataLocalisationType = function(data) {
            if (data.getNumberOfColumns() >= 2) {
                if ((data.getColumnType(0) == 'number') && (data.getColumnType(1) == 'number'))
                    return 'latlng';
            }
            if (data.getNumberOfColumns() >= 1) {
                if (data.getColumnType(0) == 'string')
                    return 'address';
            }
        }

        /** 
         * @name createXmlInfoTable
         * @methodOf datasix.visualization.OLMap.prototype
         * @description Draws the chart.
         * @param {xmldom} xmldom
         * @param {google.visualization.DataTable} data
         * @param {number} row
         * @param {number} colFrom
         * @returns {node} Table node
         */
        this.createXmlInfoTable = function(xmldom, data, row, colFrom) {
            var nodeTable = xmldom.createElement('table');
            for (var c = colFrom; c < data.getNumberOfColumns(); c++) {
                var nodeTR = xmldomCreateChildNode(nodeTable, 'tr');
                var nodeTD = xmldomCreateChildNode(nodeTR, 'td');
                var nodeB = xmldomCreateChildNode(nodeTD, 'b');
                xmldomSetNodeText(nodeB, data.getColumnLabel(c) + ':');
                nodeTD = xmldomCreateChildNode(nodeTR, 'td');
                xmldomSetAttribute(nodeTD, 'style', 'padding-left:5px')
                xmldomSetNodeText(nodeTD, data.getFormattedValue(row, c));
            }

            return nodeTable;
        }

        /**
         *
         **/
        function getColInfos(node) {
            var objectRet = {
                formattedValue: false,
                col: undefined
            };

            var col = xmldomGetAttrValueInt(node, "col");
            if (col === undefined) {
                col = xmldomGetAttrValueInt(node, "colf");
                objectRet.formattedValue = true;
            }

            if ((col !== undefined) && !isNaN(col)) {
                objectRet.col = col;
            }

            return objectRet;
        }

        /** 
         * @name buildInfo
         * @methodOf datasix.visualization.OLMap.prototype
         * @description Draws the chart.
         * @param {google.visualization.DataTable} data
         * @param {number} row
         * @param {number} baseColumnRange
         * @param {string} info
         * @returns {string}
         */
        this.buildInfo = function(data, row, baseColumnRange, info) {
            try {
                if (typeof(info) === 'string') {
                    if (info.length > 0) {
                        var xmldom = xmldomNewDOM(info);
                        var modified = false;
                        do {
                            modified = false;
                            var nodeParamList = xmldomSelectNodes(xmldom, "//cndvalue");
                            modified |= (nodeParamList.length > 0);
                            for (var i = 0; i < nodeParamList.length; i++) {
                                var nodeReplaced = false;
                                var colInfos = getColInfos(nodeParamList[i]);
                                if (colInfos.col !== undefined) {
                                    colInfos.col += baseColumnRange;
                                    if (colInfos.col < data.getNumberOfColumns()) {
                                        var encoded = (xmldomGetAttrValue(nodeParamList[i], "encoded", '0') == '1');
                                        var escaped = (xmldomGetAttrValue(nodeParamList[i], "escaped", '0') == '1');
                                        var value = colInfos.formattedValue ? data.getFormattedValue(row, colInfos.col) :
                                            data.getValue(row, colInfos.col);
                                        if (escaped)
                                            value = cnd.ebis.Parameter.escapeValue(value);
                                        if (encoded)
                                            value = encodeURIComponent(value);

                                        xmldomReplaceNodeByString(nodeParamList[i], value);
                                        nodeReplaced = true;
                                    } else {
                                        throw ("cndvalue - col#" + (colInfos.col - baseColumnRange).toString() + " out of range");
                                    }
                                }

                                if (nodeReplaced == false) {
                                    nodeParamList[i].parentNode.removeChild(nodeParamList[i]);
                                }
                            }

                            nodeParamList = xmldomSelectNodes(xmldom, "//cndheader");
                            modified |= (nodeParamList.length > 0);
                            for (var i = 0; i < nodeParamList.length; i++) {
                                var col = xmldomGetAttrValueInt(nodeParamList[i], "col");
                                col += baseColumnRange;
                                if (col < data.getNumberOfColumns()) {
                                    xmldomReplaceNodeByString(nodeParamList[i], data.getColumnLabel(col));
                                } else {
                                    throw ("cndheader - col#" + (col - baseColumnRange).toString() + " out of range");
                                    nodeParamList[i].parentNode.removeChild(nodeParamList[i]);
                                }
                            }

                            nodeParamList = xmldomSelectNodes(xmldom, "//cndcolumns");
                            modified |= (nodeParamList.length > 0);
                            for (var i = 0; i < nodeParamList.length; i++) {
                                var colFrom = xmldomGetAttrValueInt(nodeParamList[i], "from");
                                colFrom += baseColumnRange;
                                if (colFrom < data.getNumberOfColumns()) {
                                    var nodeTable = this.createXmlInfoTable(xmldom, data, row, colFrom);
                                    xmldomReplaceNode(nodeParamList[i], nodeTable);
                                } else {
                                    nodeParamList[i].parentNode.removeChild(nodeParamList[i]);
                                }
                            }

                            nodeParamList = xmldomSelectNodes(xmldom, "//cndparam");
                            modified |= (nodeParamList.length > 0);
                            for (var i = 0; i < nodeParamList.length; i++) {
                                var paramName = xmldomGetAttrValue(nodeParamList[i], "name", '');
                                var encoded = (xmldomSelectSingleNode(nodeParamList[i], "encoded", '0') == '1');
                                var escaped = (xmldomSelectSingleNode(nodeParamList[i], "escaped", '0') == '1');
                                var nodeReplaced = false
                                if (paramName.length > 0) {
                                    if (m_iParamValues) {
                                        // Pour provoquer une exception si n'existe pas...
                                        m_iParamValues.getParameter(paramName);

                                        var paramValue = m_iParamValues.getValueAsString(paramName, undefined, undefined, escaped);
                                        if (encoded)
                                            paramValue = encodeURIComponent(paramValue);
                                        xmldomReplaceNodeByString(nodeParamList[i], paramValue);
                                        nodeReplaced = true;
                                    }
                                }

                                if (nodeReplaced == false) {
                                    nodeParamList[i].parentNode.removeChild(nodeParamList[i]);
                                }
                            }

                            nodeParamList = xmldomSelectNodes(xmldom, "//cndattr");
                            modified |= (nodeParamList.length > 0);
                            for (var i = 0; i < nodeParamList.length; i++) {
                                var attrName = xmldomGetAttrValue(nodeParamList[i], "name");

                                if ((attrName !== undefined) && (attrName.length > 0)) {
                                    var attrContent = xmldomGetNodeText(nodeParamList[i]);

                                    var value;
                                    if (attrContent.length > 0) {
                                        value = attrContent;
                                    } else {
                                        var colInfos = getColInfos(nodeParamList[i]);
                                        if (colInfos.col !== undefined) {
                                            colInfos.col += baseColumnRange;
                                            if (colInfos.col < data.getNumberOfColumns()) {
                                                value = colInfos.formattedValue ? data.getFormattedValue(row, colInfos.col) :
                                                    data.getValue(row, colInfos.col);
                                            } else {
                                                throw ("cndattr - col#" + (colInfos.col - baseColumnRange).toString() + " out of range");
                                            }
                                        }
                                    }

                                    if (value !== undefined) {
                                        var path = xmldomGetAttrValue(nodeParamList[i], "dir");
                                        if (path !== undefined)
                                            value = cnd.ebis.pathfile.checkImagePath(value, path);

                                        xmldomSetAttribute(nodeParamList[i].parentNode, attrName, value);
                                    }
                                }

                                nodeParamList[i].parentNode.removeChild(nodeParamList[i]);
                            }
                        }
                        while (modified);

                        return xmldomGetXML(xmldom);
                    }

                    // Info vide --- Show all columns...
                    else {
                        var xmldom = xmldomNewDOM("<html><body></body></html>");
                        var nodeTable = this.createXmlInfoTable(xmldom, data, row, baseColumnRange);
                        var nodeBody = xmldomSelectSingleNode(xmldom, "/html/body");
                        nodeBody.appendChild(nodeTable);

                        return xmldomGetXML(xmldom);
                    }
                } else
                if (typeof(info) === 'object') {
                    return this.buildInfo(data, row, baseColumnRange, this.updateObject(data, row, baseColumnRange, info));
                }
            } catch (e) {
                var xmldom = xmldomNewDOM("<html><body></body></html>");
                var nodeBody = xmldomSelectSingleNode(xmldom, "/html/body");
                xmldomSetNodeText(nodeBody, e.toString());
                return xmldomGetXML(xmldom);
            }
        }

        /** 
         * @name translateExpression
         * @methodOf datasix.visualization.OLMap.prototype
         * @description translate expression to value.
         * @example
         *   {cndvalue: 0}: Take formated value from column 0
         *   {cndheader: 0}: Take header value from column 0
         * @param {google.visualization.DataTable} data
         * @param {number} row
         * @param {number} baseColumnRange
         * @param {string} expression
         * @returns {string}
         */
        this.translateExpression = function(data, row, baseColumnRange, expression) {
            if (typeof(expression) === 'object') {
                var col;
                var eltName = ['cndvalue', 'cndfvalue', 'cndheader', 'cndparam'];
                var eltIdx;
                for (var i = 0; i < eltName.length; i++) {
                    if (expression[eltName[i]] !== undefined) {
                        eltIdx = i;
                        break;
                    }
                }
                if (eltIdx !== undefined) {
                    switch (eltName[eltIdx]) {
                        case 'cndparam':
                            {
                                var paramName = expression[eltName[eltIdx]];
                                if (paramName.length > 0) {
                                    if (m_iParamValues) {
                                        // Pour provoquer une exception si n'existe pas...
                                        m_iParamValues.getParameter(paramName);
                                        return m_iParamValues.getValueAsString(paramName, undefined, undefined, expression.escaped);
                                    }
                                }
                            }

                        default:
                            {
                                var col = parseInt(expression[eltName[eltIdx]]);
                                if (!isNaN(col)) {
                                    col += baseColumnRange;
                                    if (col < data.getNumberOfColumns()) {
                                        var value;
                                        switch (eltName[eltIdx]) {
                                            case 'cndvalue':
                                                value = data.getValue(row, col);
                                                if (expression.dir !== undefined)
                                                    value = cnd.ebis.pathfile.checkImagePath(value, expression.dir);
                                                return value;

                                            case 'cndfvalue':
                                                value = data.getFormattedValue(row, col);
                                                if (expression.dir !== undefined)
                                                    value = cnd.ebis.pathfile.checkImagePath(value, expression.dir);
                                                return value;

                                            case 'cndheader':
                                                return data.getColumnLabel(col);
                                        }
                                    } else {
                                        return undefined;
                                    }
                                }
                            }
                    }
                }
            }

            return expression;
        }

        /** 
         * @name updateObject
         * @methodOf datasix.visualization.OLMap.prototype
         * @description translate expression to value.
         * @example
         *   {cndvalue: 0}: Take formated value from column 0
         *   {cndheader: 0}: Take header value from column 0
         * @param {google.visualization.DataTable} data
         * @param {number} row
         * @param {number} baseColumnRange
         * @param {object} object
         */
        this.updateObject = function(data, row, baseColumnRange, object) {
            if (typeof(object) === 'object') {
                for (var elt in object) {
                    if (typeof(object[elt]) == 'object') {
                        object[elt] = this.updateObject(data, row, baseColumnRange, object[elt]);

                        // Pour être sur que tout est renseigné.
                        if (object[elt] === undefined)
                            return undefined;
                    }
                }

                return this.translateExpression(data, row, baseColumnRange, object);
            }

            return object;
        }


        /** 
         * @name buildIcon
         * @methodOf datasix.visualization.OLMap.prototype
         * @description Draws the chart.
         * @param {google.visualization.DataTable} data
         * @param {number} row
         * @param {number} baseColumnRange
         * @param {object} icon https://developers.google.com/maps/documentation/javascript/reference?hl=fr#Icon
         * @returns {string}
         */
        this.buildIcon = function(data, row, baseColumnRange, icon) {
            if (typeof(icon) === 'object') {
                var iconRet = cnd.ebis.object.clone(icon);
                iconRet = this.updateObject(data, row, baseColumnRange, iconRet);
                if (iconRet !== undefined) {
                    //iconRet.url = cnd.ebis.pathfile.checkImagePath(iconRet.url, 'mapicons');
                    iconRet.url = cnd.ebis.pathfile.checkImagePath(iconRet.url);
                }

                return iconRet;
            }
        }

        /** 
         * @name setError
         * @methodOf datasix.visualization.OLMap.prototype
         * @description @link <a href="https://developers.google.com/chart/interactive/docs/reference?hl=ja#errordisplay." />Error Display Google documentation</a>
         */
        this.setError = function(message, opt_detailedMessage /*=undefined*/ , opt_options /*=undefined*/ ) {
            google.visualization.errors.removeAll(m_container);
            m_map = undefined;
            $(m_container).empty();
            google.visualization.errors.addError(m_container, message, opt_detailedMessage, opt_options);
        }

        /** 
         * @name applyData
         * @methodOf datasix.visualization.OLMap.prototype
         * @param {google.visualization.DataTable} data
         * @param {object} [options]
         */
        this.applyData = function(data, options) {
            // --- datasix.dev :  begin
            try {
                if (data !== undefined) {
                    // https://developers.google.com/maps/documentation/javascript/reference?hl=fr#Marker
                    // if data is ['Lat', 'Lon', 'Name',...]...
                    // https://developers.google.com/chart/interactive/docs/gallery/map?hl=en#Data_Format
                    var $this = this;
                    var locObj = {
                        markers: [],
                        circles: []
                    };
                    var nCols = data.getNumberOfColumns();
                    var dataLocalisation = this.getDataLocalisationType(data);
                    var baseColumnRange;
                    switch (dataLocalisation) {
                        case 'latlng':
                            if (nCols < 2) {
                                this.setError("Number of columns must be greater or equal to 2");
                                this.fireReady();
                                return;
                            }
                            if (nCols > 2)
                                baseColumnRange = 2;
                            break;

                        case 'address':
                            if (nCols < 1) {
                                this.setError("Number of columns must be greater or equal to 1");
                                this.fireReady();
                                return;
                            }
                            if (nCols > 1)
                                baseColumnRange = 1;
                            break;

                        default:
                            {
                                this.setError("Unknown data localisation: " + dataLocalisation);
                                this.fireReady();
                                return;
                            }

                    }

                    // for markers...          
                    var dataFormatInfos = this.getDataFormatInfos(options.dataFormat);
                    if (dataFormatInfos === undefined) {
                        this.setError("Unknown data format for Info attribute: " + options.dataFormat);
                        this.fireReady();
                        return;
                    }

                    var bShowMarkers = (dataFormatInfos.markerOptions !== undefined);
                    this.logDebug('[applyData] bShowMarkers: ' + bShowMarkers, true);
                    /*if (cnd.ebis.html.isModeEdit())
          {
            dataFormatInfos.markerOptions = undefined;
            dataFormatInfos.circleOptions = undefined;
          }*/
                    var bShowCircles = ((dataFormatInfos.circleOptions !== undefined) && (dataFormatInfos.circleOptions.value !== undefined));



                    /*if (bShowCircles && ((dataFormatInfos.circleOptions === undefined) || (dataFormatInfos.circleOptions.value === undefined)))
          {
            this.setError("Unable to draw circles - property: 'value' in the data format: '" + options.dataFormat + "' undefined.");
            this.fireReady();
            return;
          } */

                    for (var i = 0; i < data.getNumberOfRows(); i++) {
                        switch (dataLocalisation) {
                            case 'latlng':
                                if (bShowMarkers) {
                                    locObj.markers[i] = {
                                        lat: data.getValue(i, 0),
                                        lng: data.getValue(i, 1)
                                    };
                                }
                                if (bShowCircles) {
                                    locObj.circles[i] = {
                                        lat: data.getValue(i, 0),
                                        lng: data.getValue(i, 1)
                                    };
                                }
                                break;

                            case 'address':
                                getGeocodeOSM(data.getValue(i, 0),
                                    true,
                                    function(geocode) {
                                        if (bShowMarkers) {
                                            locObj.markers[i] = {
                                                lat: geocode[0].lat,
                                                lng: geocode[0].lon
                                            };
                                        }

                                        if (bShowCircles) {
                                            locObj.circles[i] = {
                                                lat: geocode[0].lat,
                                                lng: geocode[0].lon
                                            };
                                        }
                                    });
                                // https://developers.google.com/maps/documentation/business/faq#clientside_limits
                                // -------------------------------------------------------------------------------
                                /*getGeocode(data.getValue(i, 0), 
                             true, 
                             function(geocode)
                             {
                              if (bShowMarkers) {
                                locObj.markers[i] = {lat: geocode.geometry.location.lat,
                                                     lng: geocode.geometry.location.lng};
                              }

                              if (bShowCircles) {
                                locObj.circles[i] = {lat: geocode.geometry.location.lat,
                                                     lng: geocode.geometry.location.lng};
                              }
                });*/
                                break;
                        }


                        for (var elt in dataFormatInfos.markerOptions) {
                            var value = undefined;
                            switch (elt) {
                                case 'info':
                                    value = this.buildInfo(data, i, baseColumnRange, dataFormatInfos.markerOptions[elt]);
                                    break;

                                case 'shadow':
                                    if (dataFormatInfos.markerOptions[elt] === undefined)
                                        dataFormatInfos.markerOptions[elt] = '_shadow_blank.png';
                                case 'icon':
                                    value = this.buildIcon(data, i, baseColumnRange, dataFormatInfos.markerOptions[elt]);
                                    break;

                                default:
                                    value = this.updateObject(data, i, baseColumnRange, dataFormatInfos.markerOptions[elt]);
                            }

                            if (value !== undefined) {
                                if (bShowMarkers)
                                    locObj.markers[i][elt] = value;
                            }
                        }

                        if (bShowCircles) {
                            var circle = locObj.circles[i];
                            circle.fillColor = options.fillColor;
                            circle.fillOpacity = (options.fillOpacity < 1) ? options.fillOpacity : options.fillOpacity / 100;
                            circle.strokeColor = options.strokeColor;
                            circle.strokeWeight = 1;
                            circle.radius = 10000; //meters
                            circle.value = this.updateObject(data, i, baseColumnRange, dataFormatInfos.circleOptions.value); //data.getValue(i, baseColumnRange + 1); //Value to use in radius (first value behind localisation (lat/long or address))
                            circle.valueColor = this.updateObject(data, i, baseColumnRange, dataFormatInfos.circleOptions.valueColor); //Value to use in gradient color 
                            circle.proportional = options.proportional;

                            var colOpts = {
                                "stroke": options.strokeColor,
                                "min": options.fillColorMin,
                                "med": options.fillColorMed,
                                "max": options.fillColorMax
                            }
                        }
                    }

                    //this.logDebug (JSON.stringify(locObj));
                    //this.setMarkers(locObj);

                    if (bShowMarkers) {
                        var sMtimeB = new Date();
                        this.setMarkers(locObj.markers);
                        var sMtimeE = new Date();
                        this.logDebug("setMarkers (seconds): " + (sMtimeE.getTime() - sMtimeB.getTime()) / 1000, true);
                    }

                    //Check if there is values for Circles and user select draw it
                    if (bShowCircles && locObj.circles.length == 0) {
                        google.visualization.errors.addError(m_container,
                            "ERROR loading values for circles: There isn't values to draw",
                            "", {
                                "showInTooltip": false,
                                "removable": false
                            }
                        );
                        // Adjust errors DIV  to tooltip error span
                        $("#" + m_container.id + " > div:first-child").css('height', $("#" + m_container.id + " > div:first-child > div > span").css('height'));
                    } else {
                        if (bShowCircles) {
                            sMtimeB = new Date();
                            this.setCircles(locObj.circles, colOpts);
                            sMtimeE = new Date();
                            this.logDebug("setCircles (seconds): " + (sMtimeE.getTime() - sMtimeB.getTime()) / 1000);
                        }
                    }
                }
            } catch (e) {
                m_map = undefined;
                $($(m_container).children()[0]).remove();
                this.setError(e.toString());
                this.fireReady();
                return;
            }

            this.fireReady();
            // --- datasix.dev :  end
        }


        /** 
         * @name addOLMapLayer
         * @methodOf datasix.visualization.OLMap.prototype
         * @description add layer to OLMap...
         */
        this.addOLMapLayer = function(olMopts) {

            var _lyr;

            this.logDebug('[addOLMapLayer] olMopts: ', true);
            this.logDebug(olMopts, true);

            if (!olMopts.center) {
                alert("ERROR: the layer '" + olMopts.name + "' doesn't have defined center points for lon and lat.");
                /*
                google.visualization.errors.addError(m_container,
                    "ERROR: the layer '" + olMopts.name + "' doesn't have defined center points for lon and lat.",
                    "", {
                        "showInTooltip": false,
                        "removable": false
                    });
                */
            } else {
                switch (olMopts.layerType) {
                    case "Google":
                        _lyr = new OpenLayers.Layer.Google(olMopts.OLBase);
                        break;
                    case "OSM":
                        _lyr = new OpenLayers.Layer.OSM();
                        break;
                }
                // Control of layer load finished
                _lyr.events.register("loadend", _lyr, function() {
                    m_OLBaseLoaded = true;
                })

                m_map.addLayer(_lyr);
                var center = new OpenLayers.LonLat(olMopts.center.lon, olMopts.center.lat).transform(
                    new OpenLayers.Projection("EPSG:4326"),
                    m_map.getProjectionObject());

                this.logDebug('olMopts.center.lon: ' + olMopts.center.lon + ' / olMopts.center.lat: ' + olMopts.center.lat, true);
                this.logDebug('m_map.getProjection(): ' + m_map.getProjection(), true);

                var zoom = (8 || olMopts.zoom);

                m_map.setCenter(center, zoom);
            }
        }

        /** 
         * @name draw
         * @methodOf datasix.visualization.OLMap.prototype
         * @description Draws the OpenLayers Map chart.
         * @param {google.visualization.DataTable} data
         * @param {object} [options]
         */
        this.draw = function(data, options) {

            if (cnd.ebis.html.isModeEdit()) return false;

            google.visualization.errors.removeAll(m_container);
            //this.logDebug ('datasix.visualization.OLMap.draw');
            if (m_container === undefined)
            //throw ("datasix.visualization.OLMap.draw container undefined.");
            {
                this.setError("datasix.visualization.OLMap.draw container undefined.");
                this.fireReady();
                return;
            }


            m_dataToApply = data;


            /* --- DATASIX.Dev :: begin --- */
            m_timesFlag += 1;
            //this.logDebug ("m_timesFlag: " + m_timesFlag);  
            /* --- DATASIX.Dev :: end --- */

            //* --- DATASIX.DEV@OL :: begin --- */
            var oDVCE = datasix.visualization.ChartEditor;
            var divEltId = 'datasix_visualization_olMap';
            var $divElt = $(m_container).find('#' + divEltId);
            if ($divElt.length == 0) {
                var divElt = document.createElement('div');
                $divElt = $(divElt);
                $divElt.attr('id', divEltId);
                m_container.appendChild(divElt);
            }

            $divElt.css('position', 'relative');
            $divElt.css('top', '0px');
            $divElt.css('left', '0px');
            $divElt.css('height', options.height || '100%');
            $divElt.css('width', options.width || '100%');

            this.logDebug('m_map undefined? (olMap.draw): ' + m_map === undefined, true);

            if (m_map === undefined) {
                m_map = new OpenLayers.Map($divElt.get(0));
                this.logDebug('[OL] m_map!', true);
                this.logDebug('options: ', true);
                this.logDebug(options, true);


                // If options undefined or we are in Edit Mode... set default options value here!
                this.logDebug('isModeEdit: ' + cnd.ebis.html.isModeEdit(), true);
                if (options.OLBase === undefined) {
                    //options.layerType = 'Google';
                    options.OLBase = 'Google Streets';
                    delete options.mapTypeId; //delete property mapTypeId because this is for GMap
                    var gstr = new OpenLayers.Layer.Google("Google Streets");
                    m_map.addLayers([gstr]);
                    var center = new OpenLayers.LonLat(-122.0853, 37.4232).transform(
                        new OpenLayers.Projection("EPSG:4326"),
                        m_map.getProjectionObject());
                    var zoom = 6;
                    m_map.setCenter(center, zoom);
                    this.logDebug('Default OLMap!!; options: ', true);
                    this.logDebug(options, true);
                } else {
                    if (!cnd.ebis.html.isModeEdit()) {
                        this.logDebug('OLMap with OLBase defined....', true);
                        this.logDebug('getOLLayersInfos("' + options.OLBase + '"):', true);
                        this.logDebug(oDVCE.getOLLayersInfos(options.OLBase), true);
                        this.logDebug('OLMap options: ', true);
                        this.logDebug(options, true);
                        this.addOLMapLayer(oDVCE.getOLLayersInfos(options.OLBase));
                    }
                }


                /* -- DATASIX.Dev : end -- */

                /* >>>>> DATASIX.Dev@OL :.  DISABLED  .: begin 

                //Add listener to close all infowindow if click in map
                google.maps.event.addListener(m_map, 'click', function() {
                    closeAllInfoWindows();
                });

                //Inform about Current Map Zoom
                google.maps.event.addListener(m_map, 'zoom_changed', function() {
                    //this.logDebug ('Current Map Zoom: ' + m_map.getZoom());
                });

                var $this = this;
                //Inform about the viewport bounds have changed.
                google.maps.event.addListener(m_map, 'bounds_changed', function() {
                    //console.log("bounds_changed...");
                    if (m_dataToApply) {
                        var dataTmp = m_dataToApply;
                        m_dataToApply = undefined;
                        $this.applyData(dataTmp, options);
                    }
                });

                //Add listener to resize map when change size of ChartWrapper
                google.maps.event.addListener(m_container, 'resize', resizeMap());

                DATASIX.Dev@OL :.  DISABLED  .: end <<<<< */
            } else {
                m_map.setOptions(options);
                //$(m_container).css('visibility','visible');
            }


            if (m_OLBaseLoaded) {
                m_dataToApply = undefined;
                this.applyData(data, options);
            } else
            if (data === undefined) {
                this.fireReady();
            }
        }


        /** 
         * @name getSelection
         * @methodOf datasix.visualization.OLMap.prototype
         * @description Returns an array of the selected chart entities. Selectable entities are regions with an assigned value. A region correlates to a row in the data table (column index is null). For this chart, only one entity can be selected at any given moment
         * @returns {array} Array of selection elements
         */
        this.getSelection = function() {
            var arraySelection = [];
            if (m_currentSelection !== undefined)
                arraySelection.push({
                    row: m_currentSelection.row,
                    column: m_currentSelection.column
                });
            return arraySelection;
        }

        /** 
         * @event
         * @name fireReady
         * @methodOf datasix.visualization.OLMap.prototype
         * @description The chart is ready for external method calls. If you want to interact with the chart, and call methods after you draw it, you should set up a listener for this event before you call the draw method, and call them only after the event was fired.
         */
        this.fireReady = function() {
            console.log('>>> d.v.OLMap.fireReady()');
            $(this).trigger('ready');

            /*if (m_map !== undefined)
      {
        //Add listener to close all infowindow if click in map
        google.maps.event.addListener(m_map, 'click', function() 
        {
            closeAllInfoWindows();
        });

        //Inform about Current Map Zoom
        google.maps.event.addListener(m_map, 'zoom_changed', function() 
        {
            //this.logDebug ('Current Map Zoom: ' + m_map.getZoom());
        });
      
        //Inform about the viewport bounds have changed.
        google.maps.event.addListener(m_map, 'bounds_changed', function() 
        {
            console.log("bounds_changed...");
        });
        
        //Add listener to resize map when change size of ChartWrapper
        google.maps.event.addListener(m_container, 'resize', resizeMap());
      }*/
        }

        /** 
         * @event
         * @name fireSelect
         * @methodOf datasix.visualization.OLMap.prototype
         * @description Fired when the user clicks a visual entity. To learn what has been selected, call getSelection().
         */
        this.fireSelect = function() {
            //this.logDebug ('this.fireSelect :: ¿getSelection()?');
            $(this).trigger('select');
        }

        /** 
         * @event
         * @name resizeMap
         * @description Fired when the user change size of ChartWrapper
         */
        function resizeMap() {
            google.maps.event.trigger(m_map, 'resize');
        }

        /*
         * @function
         * @name this.logDebug
         * @description If m_debug it's true, it shows information of debug in Browser LOG
         */
        this.logDebug = function(txt, b) {
            if (m_debug || b) {
                if (txt instanceof Object) {
                    console.dir(txt);
                } else {
                    console.log(txt);
                }
            }
        }

    }

    return visualization;
})(datasix.visualization || {});
