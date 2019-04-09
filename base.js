function LoadTypes(category) {
    return new Promise(function(accept, reject) {
        var data = [];
        for(var i = 0; i < TypeIds.length; ++i) {
            var a = TypeIds[i];
            if(a[3] === null && a[2] === category) {
                data.push(a[1]);
            }
        }
        var itemCount = data.length;
        if(itemCount === 0) {
            accept(TypeIds);
            return;
        }
        data = 'usesystem=30000142&typeid='+data.join(',');
        $.ajax('https://api.evemarketer.com/ec/marketstat/json', {
            method:'GET',
            data: data,
            accept: 'application/json',
            error: function(jqXHR, textStatus, errorThrown) {
                reject(errorThrown);
                accept = reject = function(){};
                return;
            },
            success: function(response, textStatus, jqXHR) {
                console.debug(response);
                if(typeof response === "string")
                    response = JSON.parse(response);
                if(typeof response !== "object" || response.length !== itemCount) {
                    reject("Invalid Server Response");
                    accept = reject = function(){};
                    return;
                }
                for(var i = 0; i < itemCount; ++i) {
                    var obj = response[i];
                    if(typeof obj !== 'object' ||
                       typeof obj.buy !== 'object' ||
                       typeof obj.buy.forQuery !== 'object' ||
                       typeof obj.buy.forQuery.types !== 'object' ||
                       obj.buy.forQuery.types.length !== 1 ||
                       typeof obj.buy.max !== 'number') {
                        console.debug("Invalid response object at index", i, obj);
                        reject("Invalid Server Response");
                        accept = reject = function(){};
                        return;
                    }
                    var id = obj.buy.forQuery.types[0];
                    if(typeof ById[id] !== "object") {
                        console.debug("Unknown type ", id, obj);
                        reject("Invalid Server Response");
                        accept = reject = function(){};
                        return;
                    }
                    ById[id][3] = obj.buy.max;
                }
                accept(TypeIds);
                accept = reject = function(){};
                return;
            }
        });
    });
}

var GuiElements = {};

function FormatISK(v) {
    return Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function Total(event) {
    if(this) {
        var v = Number($(this).val().replace(/\..*/g,'').replace(/[^0-9]*/g,''));
        $(this).val(v);
        var tds = $(this).parent().parent('tr').children('td');
        var mult = Number($(tds[1]).text().replace(/[^0-9\.]*/g,''));
        console.debug(v, mult, v * mult);
        $(tds[3]).text(FormatISK(v * mult));
    }
    var total = 0;
    $('#tally tbody tr').each(function() {
        total += Number($(this).children('td').last().text().replace(/[^0-9\.]*/g,''));
    });
    $('#total').text(FormatISK(total));
}

function AddItem(item) {
    var input;
    $('#tally tbody').append(crel('tr', {'data-id':item[1]}, [
        crel('td', item[0]),
        crel('td', FormatISK(item[3] * CurrentRate)),
        crel('td', $(input = crel('input', {type:'text',pattern:'^[0-9]*$'})).blur(Total).keyup(EnterKey)[0]),
        crel('td', FormatISK(0))
    ]));
    $(input).focus();
}
function ClickAdd(event) {
    $(this).off('click').parent('li').addClass('ui-state-disabled');
    $('#add-menu').hide();
    var item = ById[$(this).data('id')];
    if(typeof item !== 'object' || item.length !== 4)
        throw new Error("Couldn't find item for "+$(this).data('id'));
	AddItem(item);
}

function EnterKey(event) {
    console.debug(event.which);
    if ( event.which == 13 )
        $(this).blur();
}

var ById = {};
var ByName = {};
(function(){
	for(var i = 0; i < TypeIds.length; ++i) {
		var t = TypeIds[i];
		ById[t[1]] = t;
		ByName[t[0]] = t;
	}
})();

function SearchItem(event, ui) {
	var $s = $('#search-items');
	console.debug(event, ui);
	var n;
	if(typeof ui === 'object' && typeof ui.item === 'object') {
		n = ui.item.value;
	} else {
		n = $s.val();
	}
	var item = ByName[n];
	if(typeof item !== "object" && n.length > 0) {
		var ac = $s.autocomplete('option', 'source');
		var r = n.toUpperCase();
		for(var i = 0; i < ac.length; ++i) {
			if(ac[i].toUpperCase().indexOf(r) >= 0) {
				n = ac[i];
				item = ByName[n];
				break;
			}
		}
	}
	if(typeof item !== "object") {
		console.debug("Couldn't find ",n);
		$s.select();
		return;
	}
	$s.val('');
	$('#add-menu').find('[data-id='+item[1]+']').off('click').parent('li').addClass('ui-state-disabled');
	AddItem(item);
}

$(document).ready(function() {
    var ready = false;
	$('#current-rate').text(CurrentRate * 100);
    var $dialog = $("#dialog-message").text('Loading Data...').dialog({
        modal: true,
        closeOnEscape: false,
        title: 'Please Wait',
        beforeClose: function(event, ui) { return ready; }
    });
    var ps = new Array(Categories.length);
    for(var i = 0; i < ps.length; ++i)
        ps[i] = LoadTypes(Categories[i]);
    Promise.all(ps).then(function() {
        console.debug('All loaded');
        ready = true;
        $dialog.close();
    })['catch'](function(error) {
        ready = true;
        $dialog.dialog("close");
        $dialog.addClass('ui-state-error').text("Error loading market data: "+error);
        $dialog.dialog('option','buttons', {Ok: function(){
            $dialog.close();
        }});
    });
    var menu = $('#add-menu')[0];
    var cu = {};
    for(var i = 0; i < Categories.length; ++i) {
        var ul = crel('ul');
        var c = Categories[i];
        $(menu).append(crel('li', [crel('div', c), cu[c] = crel('ul')]));
    }

    var ac = [];
    for(var j = 0; j < TypeIds.length; ++j) {
        var t = TypeIds[j];
        $(cu[t[2]]).append(crel('li', $(crel('div', {'data-id':t[1]}, t[0])).click(ClickAdd)[0]));
		ac.push(t[0]);
    }
    var b = $('#add-item');
    $(menu).menu({position:{ my:"left top", at:"right top", collision:"none"}}).hide();
    b
	.addClass('ui-icon-only')
	.click(function(event) {
		var m = $('#add-menu');
		if(m.is(':visible'))
			m.hide();
		else
			m.show().position({my:"left top", at:"right top", "of":this});
    })
	.button({ showLabel: false, icon: 'ui-icon-plusthick' });
	$('#search-items').autocomplete({
		source: ac,
		select: SearchItem
	}).keyup(function(event) {
		if(event.which === 13)
			SearchItem(event);
	});
});
