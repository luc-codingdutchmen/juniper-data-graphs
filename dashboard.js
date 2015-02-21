var interfaces = [];
var selectedDevice = null;
var timer = null;
var refreshrate = 20;

$(function() {
    setDevices();
    timer = window.setInterval(updateGraphs, refreshrate*1000);
});

function setDevices() {
    $.getJSON( "php/getDevices.php", function( data ) {
        $.each( data, function( index, value ) {
            $("#deviceselectdropdown").append(
                '<li role="presentation">'+
                    '<a role="menuitem" tabindex="-1"' +
                        'href="javascript:selectDevice(\''+value+'\')">'+value+
                    '</a>'+
                '</li>'
            );
        });
    });
}

function selectDevice(device) { 
    selectedDevice = device;
    interfaces = [];
    $("#iflist").empty();
    $.getJSON( "php/getInterfaces.php", { device: device }, function( data ) {
        $.each( data, function( index, value ) {
            interfaces[index] = [];
            interfaces[index]['name'] = value[0];
            interfaces[index]['enabled'] = false;
            $("#iflist").append(
                '<li><label><input type="checkbox" class="ifcb" id="cb-'+value+'">'+value+'</label></li>'
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
        if(value['name'] == ifid) {
            interfaces[index].enabled = enabled;
        }
    });
}

function updateGraphs() { 
    $.each( interfaces, function( index, value ) {
        if(value.enabled == true) {
            $.getJSON( "php/getGraphData.php", { device: selectedDevice, interface: value['name'] }, function( data ) {
                inBytes = [];
                inUPackets = [];
                inNUPackets = [];
                outBytes = [];
                outUPackets = [];
                outNUPackets = [];

                $.each( data, function( index, value ) {
                    inBytes.push([value.timestamp*1000, parseInt(value.delta_in_bytes)]);
                    inUPackets.push([value.timestamp*1000, parseInt(value.delta_in_u_packets)]);
                    inNUPackets.push([value.timestamp*1000, parseInt(value.delta_in_nu_packets)]);
                    outBytes.push([value.timestamp*1000, parseInt(value.delta_out_bytes)]);
                    outUPackets.push([value.timestamp*1000, parseInt(value.delta_out_u_packets)]);
                    outNUPackets.push([value.timestamp*1000, parseInt(value.delta_out_nu_packets)]);
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
}

function setData(ifid, data) { 
    $.each( interfaces, function( index, value ) {
        if(value['name'] == ifid) {
            var hchartID = "ifgraph-" + index;
            for(var i=0; i<6; i++){
                $("#" + hchartID).highcharts().series[i].setData(data[i]);
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
                        day: '%h:%m'
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
                    crosshairs: true
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
                    lineWidth: 1,
                    linkedTo: 'inbytesdata',
		    type: 'trendline',
		    algorithm: 'SMA',
                    periods: 15,
                    yAxis: 0,
                    visible: true
                },{
                    name: 'Outgoing Bytes mov. avg.',
		    color: '#000',
                    showInLegend: true,
                    lineWidth: 1,
                    linkedTo: 'outbytesdata',
		    type: 'trendline',
		    algorithm: 'SMA',
                    periods: 15,
                    yAxis: 0,
                    visible: true
		}]
            });
        }
    });
    updateGraphs();
}
