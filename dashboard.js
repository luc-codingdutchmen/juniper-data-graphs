var interfaces = [];
var selectedMachineID = null;
var timer = null;
var refreshrate = 20;
var sma_samples = 10;
var maxToMovAvg = true;
var busyFetchingGraphs = false;

$(function() {
    var d = new Date()
    Highcharts.setOptions({
        global: {
            timezoneOffset: d.getTimezoneOffset()
        }
    });

    $('#setMaxMovAvg').change(function() {
        maxToMovAvg = $(this).is(':checked');
        updateGraphs();
    });

    if (!String.prototype.format) {
        String.prototype.format = function() {
            var args = arguments;
            return this.replace(/{(\d+)}/g, function(match, number) { 
                return typeof args[number] != 'undefined'
                ? args[number]
                : match;
            });
        };
    };

    setDevices();
    timer = window.setInterval(updateGraphs, refreshrate*1000);
});

function setDevices() {
    $.getJSON( "php/getDevices.php", function( data ) {
        $.each( data, function( index, value ) {
            $("#deviceselectdropdown").append(
                '<li role="presentation">'+
                    '<a role="menuitem" tabindex="-1"' +
                        'href="javascript:selectDevice(\''+value.id+'\', \''+value.machine_name+'\')">'+value.machine_name+
                    '</a>'+
                '</li>'
            );
        });
    });
}

function selectDevice(machine_id, machine_name) { 
    selectedMachineID = machine_id;
    interfaces = {};
    $("#iflist").empty();
    $("#nav-dev-title").text(machine_name);
    $.getJSON( "php/getInterfaces.php", { machine_id: machine_id }, function( data ) {
        $.each( data, function( index, value ) {
	    interfaces[value.id] = [];
            interfaces[value.id]['name'] = value.interface_name;
            interfaces[value.id]['enabled'] = false;
            $("#iflist").append(
                '<li><label><input type="checkbox" class="ifcb" id="cb-'+value.id+'">'+value.interface_name+'</label></li>'
            );
        });
        $('.ifcb').change(function() {
            var cdid = $(this).attr("id");
            var ifid = cdid.substr(3);
            setEnabled(ifid, $(this).is(":checked"));
            setGraphs();
        });
    });
}
function setEnabled(ifid, enabled) { 
   $.each( interfaces, function( index, value ) {
        if(index == ifid) {
            interfaces[index].enabled = enabled;
        }
    });
}

function updateGraphs() { 
    if(busyFetchingGraphs) {
	console.log("busy, backing off");
        return;
    }
    busyFetchingGraphs = true;

    $.each( interfaces, function( index, value ) {
        if(value.enabled == true) {
            $.getJSON( "php/getGraphData.php", { machine_id: selectedMachineID, interface_id: index }, function( data ) {
                inBytes = [];
                inUPackets = [];
                inNUPackets = [];
                outBytes = [];
                outUPackets = [];
                outNUPackets = [];

                $.each( data, function( index, value ) {
                    inBytes.push([value.timestamp*1000, parseInt(value.delta_in_bytes, 10)]);
                    inUPackets.push([value.timestamp*1000, parseInt(value.delta_in_u_packets, 10)]);
                    inNUPackets.push([value.timestamp*1000, parseInt(value.delta_in_nu_packets, 10)]);
                    outBytes.push([value.timestamp*1000, parseInt(value.delta_out_bytes, 10)]);
                    outUPackets.push([value.timestamp*1000, parseInt(value.delta_out_u_packets, 10)]);
                    outNUPackets.push([value.timestamp*1000, parseInt(value.delta_out_nu_packets, 10)]);
                });

                setData(value['name'], [
                    inBytes,
                    inUPackets,
                    inNUPackets,
                    outBytes,
                    outUPackets,
                    outNUPackets
                ]);
            });
        }
    });
    busyFetchingGraphs = false;
}

function setData(ifid, data) { 
    $.each( interfaces, function( index, value ) {
        if(value['name'] == ifid) {
            var hchartID = "ifgraph-" + index;
            for(var i=0; i<6; i++){
                $("#" + hchartID).highcharts().series[i].setData(data[i], true);
            }

            var sma = simple_moving_averager(sma_samples);
            var maxMovAvg = 0;
            var realMax = 0;
            var in_avg = [];
            var out_avg = [];
            for( var i = 0; i < data[0].length; i++ ){
                var value = data[0][i][1];
                var avg = sma(value);
                in_avg.push([data[0][i][0], avg]);
                if (avg > maxMovAvg) { maxMovAvg = avg; }
                if (value > realMax) { realMax = value; }
            }

            for( var i = 0; i < data[3].length; i++ ){
                var value = data[3][i][1];
                var avg = sma(value);
                out_avg.push([data[3][i][0], avg]);
                if (avg > maxMovAvg) { maxMovAvg = avg; }
                if (value > realMax) { realMax = value; }
            }

            $("#" + hchartID).highcharts().series[6].setData(in_avg, true);  
            $("#" + hchartID).highcharts().series[7].setData(out_avg, true);  
           
            if(maxToMovAvg == true) {
                $("#" + hchartID).highcharts().yAxis[0].update({max: maxMovAvg});
            } else {
                $("#" + hchartID).highcharts().yAxis[0].update({max: realMax});
            }

            var d = new Date();
            var t = d.getTime();
            t = (t - (t%(60*1000)));
            $("#" + hchartID).highcharts().xAxis[0].update({ min: (t - (24*3600*1000)) });
            $("#" + hchartID).highcharts().xAxis[0].update({ max: t });
            $("#" + hchartID).highcharts().redraw();
        }
    });
}

function simple_moving_averager(period) {
    var nums = [];
    return function(num) {
        nums.push(num);
        if (nums.length > period)
            nums.splice(0,1);  // remove the first element of the array
        var sum = 0;
        for (var i in nums)
            sum += nums[i];
        var n = period;
        if (nums.length < period)
            n = nums.length;
        return(sum/n);
    }
}
function setGraphs() { 
    kb = 1000;
    mb = 1000*1000;
    gb = 1000*1000*1000;

    $("#graphcontainer").empty();
    $.each( interfaces, function( index, value ) {
        if(value.enabled) {
            var hchartID = "ifgraph-" + index;
            $("#graphcontainer").append(
                '<div class="col-12" class="ifgraph" id="ifgraph-'+index+'"></div>'
            );
            var d = new Date();
            var t = d.getTime();
            t = (t - (t%(60*1000)));
            $("#" + hchartID).highcharts({
                chart: {
                    ignoreHiddenSeries : false,
                    zoomType: 'x',
                    height: 300
                },
                title: {
                    text: value['name']
                },
                xAxis: {
                    type: "datetime",
                    dateTimeLabelFormats: {
                        minute: '%H:%M',
                        hour: '%H:%M'
                    },
                    min: t - (24*3600*1000),
                    max: t
                },
                yAxis: [{ // left y axis
                    title: {
                        text: 'bytes'
                    },
                    min: 0,
                    labels: {
                        align: 'left',
                        x: 3,
                        y: 16,
                        formatter: function() {
                            var maxElement = this.axis.max;
                            if (maxElement > gb) {
                               return (this.value / gb).toFixed(1) + " GB";
                            } else if (maxElement > mb) {
                                return (this.value / mb).toFixed(1) + " MB";
                            } else if (maxElement > kb) {
                                return (this.value / kb).toFixed(1) + " KB";
                            } else {
                                return (this.value) + " B";
                            }
                        }
                    },
                    showFirstLabel: false
                }, { // right y axis
                    gridLineWidth: 0,
                    opposite: true,
                    title: {
                        text: 'packets'
                    },
                    min: 0,
                    labels: {
                        align: 'right',
                        x: -3,
                        y: 16,
                        format: '{value:.,0f}'
                    },
                    showFirstLabel: false
                }],

                legend: {
                    align: 'left',
                    verticalAlign: 'middle',
		    layout: 'vertical',
                    y: 20,
                    floating: false,
                    borderWidth: 1
                },

                tooltip: {
                    shared: true,
                    crosshairs: [true, false],
		    pointFormatter: function() {
                        var value = this.y;
			var formatted_value = value;
			var prefix = '<span style="color:{point.color}">\u25CF</span> {series.name}: <b>{point.y}';
			var unit = ' B';
                        if (value > gb) {
			    formatted_value = parseFloat(value / gb).toFixed(2);
                            unit = " GB";
                        } else if (value > mb) {
			    formatted_value = parseFloat(value / mb).toFixed(2);
                            unit = " MB";
                        } else if (value > kb) {
			    formatted_value = parseFloat(value / kb).toFixed(2);
                            unit = " KB";
                        }
			var suffix = '</b>.<br/>'

			return '<span style="color:{point.color}">\u25CF</span>{0}: <b>{1}{2}</b><br/>'.format(this.series.name, formatted_value, unit);
                    }
                },

                series: [{
                    name: 'Incoming Bytes',
                    lineWidth: 1,
                    yAxis: 0,
		    visible: false,
		    id: 'inbytesdata'
                },{
                    name: 'Incoming Unicast Packets',
                    lineWidth: 1,
                    yAxis: 1,
                    visible: false
                },{
                    name: 'Incoming Non-Unicast Packets',
                    lineWidth: 1,
                    yAxis: 1,
                    visible: false
                },{
                    name: 'Outgoing Bytes',
                    lineWidth: 1,
		    visible: false,
                    yAxis: 0,
		    id: 'outbytesdata'
                },{
                    name: 'Outgoing Unicast Packets',
                    lineWidth: 1,
                    yAxis: 1,
                    visible: false
                },{
                    name: 'Outgoing Non-Unicast Packets',
                    lineWidth: 1,
                    yAxis: 1,
                    visible: false
                },{
                    name: 'Incoming Bytes mov. avg.',
		    color: '#F00',
                    showInLegend: true,
                    lineWidth: 2,
                    yAxis: 0,
                    visible: true
                },{
                    name: 'Outgoing Bytes mov. avg.',
		    color: '#000',
                    showInLegend: true,
                    lineWidth: 2,
                    yAxis: 0,
                    visible: true
		}]
            });
        }
    });
    updateGraphs();
}
