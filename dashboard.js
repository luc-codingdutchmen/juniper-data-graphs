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
        }
    });
}

function setGraphs() { 
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
                    height: 200
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
                        format: '{value:.,0f}'
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
                    verticalAlign: 'top',
                    y: 20,
                    floating: true,
                    borderWidth: 0
                },

                tooltip: {
                    shared: true,
                    crosshairs: true
                },

                series: [{
                    name: 'Incoming Bytes',
                    lineWidth: 1,
                    yAxis: 0,
                    marker: {
                        radius: 4
                    }
                },{
                    name: 'Incoming Unicast Packets',
                    lineWidth: 1,
                    yAxis: 1,
                    visible: false,
                    marker: {
                        radius: 4
                    }
                },{
                    name: 'Incoming Non-Unicast Packets',
                    lineWidth: 1,
                    yAxis: 1,
                    visible: false,
                    marker: {
                        radius: 4
                    }
                },{
                    name: 'Outgoing Bytes',
                    lineWidth: 1,
                    yAxis: 0,
                    marker: {
                        radius: 4
                    }
                },{
                    name: 'Outgoing Unicast Packets',
                    lineWidth: 1,
                    yAxis: 1,
                    visible: false,
                    marker: {
                        radius: 4
                    }
                },{
                    name: 'Outgoing Non-Unicast Packets',
                    lineWidth: 1,
                    yAxis: 1,
                    visible: false,
                    marker: {
                        radius: 4
                    }
                }]
            });
        }
    });
    updateGraphs();
}
