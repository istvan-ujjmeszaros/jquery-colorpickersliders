/*jshint undef: true, unused:true */
/*global jQuery: true, tinycolor: false */

/*!=========================================================================
 *  jQuery Color Picker Sliders
 *  v1.2.5
 *
 *  An advanced color selector with support for human perceived
 *  lightness (it works in the CIELab color space), and designed to work
 *  on small touch devices.
 *
 *      https://github.com/istvan-meszaros/css-colorpicker-slider
 *      http://www.virtuosoft.eu/code/css-colorpicker-slider/
 *
 *  Copyright 2013 István Ujj-Mészáros
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 *  Requirements:
 *
 *      TinyColor: https://github.com/bgrins/TinyColor
 *
 *  Using color math algorithms from EasyRGB Web site:
 *      http://www.easyrgb.com/index.php?X=MATH
 * ====================================================================== */

(function($) {
    "use strict";

    $.fn.ColorPickerSliders = function(options) {

        return this.each(function() {

            var settings = $.extend({
                color: 'hsl(342, 52%, 70%)',
                connectedinput: false,          // can be a jquery object or a selector
                flat: false,
                updateinterval: 30,             // update interval of the sliders while in drag (ms)
                previewontriggerelement: true,
                previewcontrasttreshold: 15,
                erroneousciecolormarkers: true,
                invalidcolorsopacity: 1,        // everything below 1 causes slightly slower responses
                finercierangeedges: true,       // can be disabled for faster responses
                order: {},
                labels: {},
                onchange: function() {
                }
            }, options);

            if (options.hasOwnProperty('order')) {
                settings.order = $.extend({
                    opacity: false,
                    hsl: false,
                    rgb: false,
                    cie: false,
                    preview: false
                }, options.order);
            }
            else {
                settings.order = {
                    opacity: 0,
                    hsl: 1,
                    rgb: 2,
                    cie: 3,     // cie sliders can increase response time of all sliders!
                    preview: 4
                };
            }

            if (!options.hasOwnProperty('labels')) {
                options.labels = {};
            }

            settings.labels = $.extend({
                    hslhue: 'HSL-Hue',
                    hslsaturation: 'HSL-Saturation',
                    hsllightness: 'HSL-Lightness',
                    rgbred: 'RGB-Red',
                    rgbgreen: 'RGB-Green',
                    rgbblue: 'RGB-Blue',
                    cielightness: 'CIE-Lightness',
                    ciechroma: 'CIE-Chroma',
                    ciehue: 'CIE-hue',
                    opacity: 'Opacity',
                    preview: 'Preview'
            }, options.labels);

            var triggerelement = $(this),
                container,
                elements,
                MAXLIGHT = 101, // 101 needed for bright colors (maybe due to rounding errors)
                dragTarget = false,
                lastUpdateTime = 0,
                color = {
                    tiny: null,
                    hsla: null,
                    rgba: null,
                    cielch: null
                },
                MAXVALIDCHROMA = 144;   // maximum valid chroma value found convertible to rgb (blue)

            init();

            function init()
            {
                // force preview when browser doesn't support css gradients
                if ((!settings.order.hasOwnProperty('preview') || settings.order.preview === false) && !gradientSupported()) {
                    settings.order.preview = 10;
                }

                buildHtml();
                initElements();
                bindevents();

                if (triggerelement.is("input")) {
                    color.tiny = tinycolor(triggerelement.val());

                    if (!color.tiny.format) {
                        color.tiny = tinycolor(settings.color);
                    }
                }
                else {
                    color.tiny = tinycolor(settings.color);
                }

                color.hsla = color.tiny.toHsl();
                color.rgba = color.tiny.toRgb();
                color.cielch = $.fn.ColorPickerSliders.rgb2lch(color.rgba);

                updateAllElements();
            }

            function buildHtml()
            {
                var sliders = [],
                    color_picker_html = '';

                if (settings.order.opacity !== false) {
                    sliders[settings.order.opacity] = '<div class="cp-slider cp-opacity cp-transparency"><span>' + settings.labels.opacity + '</span><div class="cp-marker"></div></div>';
                }

                if (settings.order.hsl !== false) {
                    sliders[settings.order.hsl] = '<div class="cp-slider cp-hslhue cp-transparency"><span>' + settings.labels.hslhue + '</span><div class="cp-marker"></div></div><div class="cp-slider cp-hslsaturation cp-transparency"><span>' + settings.labels.hslsaturation + '</span><div class="cp-marker"></div></div><div class="cp-slider cp-hsllightness cp-transparency"><span>' + settings.labels.hsllightness + '</span><div class="cp-marker"></div></div>';
                }

                if (settings.order.rgb !== false) {
                    sliders[settings.order.rgb] = '<div class="cp-slider cp-rgbred cp-transparency"><span>' + settings.labels.rgbred + '</span><div class="cp-marker"></div></div><div class="cp-slider cp-rgbgreen cp-transparency"><span>' + settings.labels.rgbgreen + '</span><div class="cp-marker"></div></div><div class="cp-slider cp-rgbblue cp-transparency"><span>' + settings.labels.rgbblue + '</span><div class="cp-marker"></div></div>';
                }

                if (settings.order.cie !== false) {
                    sliders[settings.order.cie] = '<div class="cp-slider cp-cielightness cp-transparency"><span>' + settings.labels.cielightness + '</span><div class="cp-marker"></div></div><div class="cp-slider cp-ciechroma cp-transparency"><span>' + settings.labels.ciechroma + '</span><div class="cp-marker"></div></div><div class="cp-slider cp-ciehue cp-transparency"><span>' + settings.labels.ciehue + '</span><div class="cp-marker"></div></div>';
                }

                if (settings.order.preview !== false) {
                    sliders[settings.order.preview] = '<div class="cp-preview cp-transparency"><input type="text" readonly="readonly"></div>';
                }

                color_picker_html += '<div class="cp-sliders">';

                for (var i=0; i<sliders.length; i++) {
                    if (typeof sliders[i] === "undefined") {
                        continue;
                    }

                    color_picker_html += sliders[i];
                }

                color_picker_html += '</div>';

                if (!settings.flat) {
                    color_picker_html += '</div>';
                }

                if (settings.flat) {
                    container = $('<div class="cp-container"></div>').insertAfter(triggerelement);
                }
                else {
                    container = $('<div class="cp-container"></div>').appendTo('body');
                }

                container.append(color_picker_html);

                if (settings.connectedinput instanceof jQuery) {
                    settings.connectedinput.add(triggerelement);
                }
                else if (settings.connectedinput === false) {
                    settings.connectedinput = triggerelement;
                }
                else {
                    settings.connectedinput = $(settings.connectedinput).add(triggerelement);
                }


                if (!settings.flat) {
                    container.addClass('cp-popup');
                }
            }

            function initElements()
            {
                elements = {
                    connectedinput: false,
                    all_sliders: $(".cp-sliders, .cp-preview input", container),
                    sliders: {
                        hue: $(".cp-hslhue span", container),
                        hue_marker: $(".cp-hslhue .cp-marker", container),
                        saturation: $(".cp-hslsaturation span", container),
                        saturation_marker: $(".cp-hslsaturation .cp-marker", container),
                        lightness: $(".cp-hsllightness span", container),
                        lightness_marker: $(".cp-hsllightness .cp-marker", container),
                        opacity: $(".cp-opacity span", container),
                        opacity_marker: $(".cp-opacity .cp-marker", container),
                        red: $(".cp-rgbred span", container),
                        red_marker: $(".cp-rgbred .cp-marker", container),
                        green: $(".cp-rgbgreen span", container),
                        green_marker: $(".cp-rgbgreen .cp-marker", container),
                        blue: $(".cp-rgbblue span", container),
                        blue_marker: $(".cp-rgbblue .cp-marker", container),
                        cielightness: $(".cp-cielightness span", container),
                        cielightness_marker: $(".cp-cielightness .cp-marker", container),
                        ciechroma: $(".cp-ciechroma span", container),
                        ciechroma_marker: $(".cp-ciechroma .cp-marker", container),
                        ciehue: $(".cp-ciehue span", container),
                        ciehue_marker: $(".cp-ciehue .cp-marker", container),
                        preview: $(".cp-preview input", container)
                    }
                };

                if (settings.connectedinput) {
                    if (settings.connectedinput instanceof jQuery) {
                        elements.connectedinput = settings.connectedinput;
                    }
                    else {
                        elements.connectedinput = $(settings.connectedinput);
                    }
                }
            }

            function gradientSupported()
            {
                var testelement = document.createElement('detectGradientSupport').style;

                testelement.backgroundImage = "linear-gradient(left top, #9f9, white)";
                testelement.backgroundImage = "-o-linear-gradient(left top, #9f9, white)";
                testelement.backgroundImage = "-moz-linear-gradient(left top, #9f9, white)";
                testelement.backgroundImage = "-webkit-linear-gradient(left top, #9f9, white)";
                testelement.backgroundImage = "-ms-linear-gradient(left top, #9f9, white)";
                testelement.backgroundImage = "-webkit-gradient(linear, left top, right bottom, from(#9f9), to(white))";

                if (testelement.backgroundImage.indexOf("gradient") === -1) {
                    return false;
                }
                else {
                    return true;
                }
            }

            function showPopup()
            {
                $('.cp-container.cp-popup').hide();

                var viewportwidth = $(window).width(),
                    offset = triggerelement.offset(),
                    popuporiginalwidth;

                popuporiginalwidth = container.data('popup-original-width');

                if (typeof popuporiginalwidth === "undefined") {
                    popuporiginalwidth = container.outerWidth();
                    container.data('popup-original-width', popuporiginalwidth);
                }

                if (offset.left + popuporiginalwidth + 12 <= viewportwidth) {
                    container.css('left', offset.left).width(popuporiginalwidth);
                }
                else if (popuporiginalwidth <= viewportwidth) {
                    container.css('left',viewportwidth - popuporiginalwidth - 12).width(popuporiginalwidth);
                }
                else {
                    container.css('left', 0).width(viewportwidth - 12);
                }

                container.css('top', offset.top + triggerelement.outerHeight()).show();
            }

            function hidePopup()
            {
                container.hide();
            }

            function bindevents()
            {
                if (!settings.flat) {
                    // we need tabindex defined to be focusable
                    if (typeof triggerelement.attr("tabindex") === "undefined") {
                        triggerelement.attr("tabindex", -1);
                    }

                    // buttons doesn't get focus in webkit browsers
                    // https://bugs.webkit.org/show_bug.cgi?id=22261
                    if (triggerelement.is("button")) {
                        $(triggerelement).on("click", function(ev){
                            showPopup();

                            ev.stopPropagation();
                        });

                        $(document).on("click", function(){
                            hidePopup();
                        });
                    }

                    $(triggerelement).on("focus", function(ev) {
                        showPopup();

                        ev.stopPropagation();
                    });

                    $(triggerelement).on("blur", function(ev) {
                        hidePopup();

                        ev.stopPropagation();
                    });

                    container.on("click", function(ev) {
                        ev.gesture.preventDefault();
                        ev.stopPropagation();

                        return false;
                    });
                }

                elements.sliders.hue.on("touchstart mousedown", function(ev) {
                    dragTarget = "hue";

                    var percent = updateMarkerPosition(dragTarget, ev);

                    updateColor('hsla', 'h', 3.6 * percent);

                    updateAllElements();

                    ev.preventDefault();
                });

                elements.sliders.saturation.on("touchstart mousedown", function(ev) {
                    dragTarget = "saturation";

                    var percent = updateMarkerPosition(dragTarget, ev);

                    updateColor('hsla', 's', percent / 100);

                    updateAllElements();

                    ev.preventDefault();
                });

                elements.sliders.lightness.on("touchstart mousedown", function(ev) {
                    dragTarget = "lightness";

                    var percent = updateMarkerPosition(dragTarget, ev);

                    updateColor('hsla', 'l', percent / 100);

                    updateAllElements();

                    ev.preventDefault();
                });

                elements.sliders.opacity.on("touchstart mousedown", function(ev) {
                    dragTarget = "opacity";

                    var percent = updateMarkerPosition(dragTarget, ev);

                    updateColor('hsla', 'a', percent / 100);

                    updateAllElements();

                    ev.preventDefault();
                });

                elements.sliders.red.on("touchstart mousedown", function(ev) {
                    dragTarget = "red";

                    var percent = updateMarkerPosition(dragTarget, ev);

                    updateColor('rgba', 'r', 2.55 * percent);

                    updateAllElements();

                    ev.preventDefault();
                });

                elements.sliders.green.on("touchstart mousedown", function(ev) {
                    dragTarget = "green";

                    var percent = updateMarkerPosition(dragTarget, ev);

                    updateColor('rgba', 'g', 2.55 * percent);

                    updateAllElements();

                    ev.preventDefault();
                });

                elements.sliders.blue.on("touchstart mousedown", function(ev) {
                    dragTarget = "blue";

                    var percent = updateMarkerPosition(dragTarget, ev);

                    updateColor('rgba', 'b', 2.55 * percent);

                    updateAllElements();

                    ev.preventDefault();
                });

                elements.sliders.cielightness.on("touchstart mousedown", function(ev) {
                    dragTarget = "cielightness";

                    var percent = updateMarkerPosition(dragTarget, ev);

                    updateColor('cielch', 'l', (MAXLIGHT / 100) * percent);

                    updateAllElements();

                    ev.preventDefault();
                });

                elements.sliders.ciechroma.on("touchstart mousedown", function(ev) {
                    dragTarget = "ciechroma";

                    var percent = updateMarkerPosition(dragTarget, ev);

                    updateColor('cielch', 'c', (MAXVALIDCHROMA / 100) * percent);

                    updateAllElements();

                    ev.preventDefault();
                });

                elements.sliders.ciehue.on("touchstart mousedown", function(ev) {
                    dragTarget = "ciehue";

                    var percent = updateMarkerPosition(dragTarget, ev);

                    updateColor('cielch', 'h', 3.6 * percent);

                    updateAllElements();

                    ev.preventDefault();
                });

                elements.sliders.preview.on("click", function(){
                    this.select();
                });

                $(document).on("touchmove mousemove", function(ev) {
                    if (!dragTarget) {
                        return;
                    }

                    var percent = updateMarkerPosition(dragTarget, ev);

                    switch (dragTarget)
                    {
                        case "hue":
                            updateColor('hsla', 'h', 3.6 * percent);
                            break;
                        case "saturation":
                            updateColor('hsla', 's', percent / 100);
                            break;
                        case "lightness":
                            updateColor('hsla', 'l', percent / 100);
                            break;
                        case "opacity":
                            updateColor('hsla', 'a', percent / 100);
                            break;
                        case "red":
                            updateColor('rgba', 'r', 2.55 * percent);
                            break;
                        case "green":
                            updateColor('rgba', 'g', 2.55 * percent);
                            break;
                        case "blue":
                            updateColor('rgba', 'b', 2.55 * percent);
                            break;
                        case "cielightness":
                            updateColor('cielch', 'l', (MAXLIGHT / 100) * percent);
                            break;
                        case "ciechroma":
                            updateColor('cielch', 'c', (MAXVALIDCHROMA / 100) * percent);
                            break;
                        case "ciehue":
                            updateColor('cielch', 'h', 3.6 * percent);
                            break;
                    }

                    updateAllElements();

                    ev.preventDefault();
                });

                $(document).on("touchend mouseup", function(ev) {
                    if (dragTarget) {
                        dragTarget = false;
                        ev.preventDefault();
                    }
                });

                if (elements.connectedinput) {
                    elements.connectedinput.on('change', function() {
                        var $input = $(this);
                        var inputtiny = tinycolor($input.val());

                        if (inputtiny.format)
                        {
                            container.removeClass("cp-unconvertible-cie-color");

                            color.tiny = tinycolor($input.val());
                            color.hsla = tinycolor($input.val()).toHsl();
                            color.rgba = tinycolor($input.val()).toRgb();
                            color.cielch = $.fn.ColorPickerSliders.rgb2lch(color.rgba);

                            updateAllElements();
                        }
                        else {
                            return false;
                        }
                    });
                }

            }

            function updateColor(format, property, value)
            {
                switch(format) {
                    case 'hsla':

                        color.hsla[property] = value;
                        color.tiny = tinycolor({h: color.hsla.h, s: color.hsla.s, l: color.hsla.l, a: color.hsla.a});
                        color.rgba = color.tiny.toRgb();
                        color.cielch = $.fn.ColorPickerSliders.rgb2lch(color.rgba);

                        container.removeClass("cp-unconvertible-cie-color");

                        break;

                    case 'rgba':

                        color.rgba[property] = value;
                        color.tiny = tinycolor({r: color.rgba.r, g: color.rgba.g, b: color.rgba.b, a: color.hsla.a});
                        color.hsla = color.tiny.toHsl();
                        color.cielch = $.fn.ColorPickerSliders.rgb2lch(color.rgba);

                        container.removeClass("cp-unconvertible-cie-color");

                        break;

                    case 'cielch':

                        color.cielch[property] = value;
                        color.rgba = $.fn.ColorPickerSliders.lch2rgb(color.cielch);
                        color.tiny = tinycolor(color.rgba);
                        color.hsla = color.tiny.toHsl();

                        if (settings.erroneousciecolormarkers) {
                            if (color.rgba.isok) {
                                container.removeClass("cp-unconvertible-cie-color");
                            }
                            else {
                                container.addClass("cp-unconvertible-cie-color");
                            }
                        }

                        break;
                }
            }

            function updateMarkerPosition(slidername, ev)
            {
                var percent = calculateEventPositionPercentage(ev, elements.sliders[slidername]);

                elements.sliders[slidername + '_marker'].data("position", percent);

                return percent;
            }

            function calculateEventPositionPercentage(ev, containerElement)
            {
                var pageX;

                if (typeof ev.pageX !== "undefined") {
                    pageX = ev.originalEvent.pageX;
                }
                else if (typeof ev.originalEvent.touches !== "undefined") {
                        pageX = ev.originalEvent.touches[0].pageX;
                }

                var xsize = containerElement.width(),
                        offsetX = pageX - containerElement.offset().left;

                var percent = offsetX / xsize * 100;

                if (percent < 0) {
                    percent = 0;
                }

                if (percent > 100) {
                    percent = 100;
                }

                return percent;
            }

            var updateAllElementsTimeout;

            function updateAllElementsTimer()
            {
                updateAllElementsTimeout = setTimeout(updateAllElements, settings.updateinterval);
            }

            function updateAllElements()
            {
                clearTimeout(updateAllElementsTimeout);

                if (Date.now() - lastUpdateTime < settings.updateinterval) {
                    updateAllElementsTimer();
                    return;
                }

                lastUpdateTime = Date.now();

                if (settings.order.opacity !== false) {
                    renderOpacity();
                }
                if (settings.order.hsl !== false) {
                    renderHue();
                    renderSaturation();
                    renderLightness();
                }
                if (settings.order.rgb !== false) {
                    renderRed();
                    renderGreen();
                    renderBlue();
                }
                if (settings.order.cie !== false) {
                    renderCieLightness();
                    renderCieChroma();
                    renderCieHue();
                }
                if (settings.order.preview !== false) {
                    renderPreview();
                }

                updateConnectedInput();

                if ((100 - color.cielch.l) * color.cielch.a < settings.previewcontrasttreshold) {
                    elements.all_sliders.css('color', '#000');
                    if (settings.previewontriggerelement) {
                        triggerelement.css('background', color.tiny.toRgbString()).css('color', '#000');
                    }
                }
                else {
                    elements.all_sliders.css('color', '#fff');
                    if (settings.previewontriggerelement) {
                        triggerelement.css('background', color.tiny.toRgbString()).css('color', '#fff');
                    }
                }

                settings.onchange(container, color);
            }

            function updateConnectedInput()
            {
                if (elements.connectedinput) {
                    elements.connectedinput.each(function(index, element) {
                        var $element = $(element);

                        switch ($element.data('color-format'))
                        {
                            case 'hex':
                                $element.val(color.tiny.toHexString());
                                break;
                            case 'hsl':
                                $element.val(color.tiny.toHslString());
                                break;
                            case 'rgb':
                            /* falls through */
                            default:
                                $element.val(color.tiny.toRgbString());
                                break;
                        }
                    });
                }

                if (settings.order.preview !== false) {
                    elements.sliders.preview.val(color.tiny.toRgbString());
                }
            }

            function renderHue()
            {
                $.fn.ColorPickerSliders.setGradient(elements.sliders.hue, $.fn.ColorPickerSliders.getScaledGradientStops(color.hsla, "h", 0, 360, 7));

                elements.sliders.hue_marker.css("left", color.hsla.h / 360 * 100 + "%");
            }

            function renderSaturation()
            {
                $.fn.ColorPickerSliders.setGradient(elements.sliders.saturation, $.fn.ColorPickerSliders.getScaledGradientStops(color.hsla, "s", 0, 1, 2));

                elements.sliders.saturation_marker.css("left", color.hsla.s * 100 + "%");
            }

            function renderLightness()
            {
                $.fn.ColorPickerSliders.setGradient(elements.sliders.lightness, $.fn.ColorPickerSliders.getScaledGradientStops(color.hsla, "l", 0, 1, 3));

                elements.sliders.lightness_marker.css("left", color.hsla.l * 100 + "%");
            }

            function renderOpacity()
            {
                $.fn.ColorPickerSliders.setGradient(elements.sliders.opacity, $.fn.ColorPickerSliders.getScaledGradientStops(color.hsla, "a", 0, 1, 2));

                elements.sliders.opacity_marker.css("left", color.hsla.a * 100 + "%");
            }

            function renderRed()
            {
                $.fn.ColorPickerSliders.setGradient(elements.sliders.red, $.fn.ColorPickerSliders.getScaledGradientStops(color.rgba, "r", 0, 255, 2));

                elements.sliders.red_marker.css("left", color.rgba.r / 255 * 100 + "%");
            }

            function renderGreen()
            {
                $.fn.ColorPickerSliders.setGradient(elements.sliders.green, $.fn.ColorPickerSliders.getScaledGradientStops(color.rgba, "g", 0, 255, 2));

                elements.sliders.green_marker.css("left", color.rgba.g / 255 * 100 + "%");
            }

            function renderBlue()
            {
                $.fn.ColorPickerSliders.setGradient(elements.sliders.blue, $.fn.ColorPickerSliders.getScaledGradientStops(color.rgba, "b", 0, 255, 2));

                elements.sliders.blue_marker.css("left", color.rgba.b / 255 * 100 + "%");
            }

            function extendCieGradientStops(gradientstops, property)
            {
                if (settings.invalidcolorsopacity === 1 || !settings.finercierangeedges) {
                    return gradientstops;
                }

                gradientstops.sort(function(a, b) {
                    return a.position - b.position;
                });

                var tmparray = [];

                for (var i=1; i<gradientstops.length; i++) {
                    if (gradientstops[i].isok !== gradientstops[i-1].isok) {
                        var steps = Math.round(gradientstops[i].position)-Math.round(gradientstops[i-1].position),
                            extendedgradientstops = $.fn.ColorPickerSliders.getScaledGradientStops(gradientstops[i].rawcolor, property, gradientstops[i-1].rawcolor[property], gradientstops[i].rawcolor[property], steps, settings.invalidcolorsopacity, gradientstops[i-1].position, gradientstops[i].position);

                        for (var j=0; j<extendedgradientstops.length; j++) {
                            if (extendedgradientstops[j].isok !== gradientstops[i-1].isok) {
                                tmparray.push(extendedgradientstops[j]);

                                if (j>0) {
                                    tmparray.push(extendedgradientstops[j-1]);
                                }

                                break;
                            }
                        }
                    }
                }

                return $.merge(tmparray, gradientstops);
            }

            function renderCieLightness()
            {
                var gradientstops = $.fn.ColorPickerSliders.getScaledGradientStops(color.cielch, "l", 0, 100, 10, settings.invalidcolorsopacity);

                gradientstops = extendCieGradientStops(gradientstops, "l");

                $.fn.ColorPickerSliders.setGradient(elements.sliders.cielightness, gradientstops);

                elements.sliders.cielightness_marker.css("left", color.cielch.l / MAXLIGHT * 100 + "%");
            }

            function renderCieChroma()
            {
                var gradientstops = $.fn.ColorPickerSliders.getScaledGradientStops(color.cielch, "c", 0, MAXVALIDCHROMA, 5, settings.invalidcolorsopacity);

                gradientstops = extendCieGradientStops(gradientstops, "c");

                $.fn.ColorPickerSliders.setGradient(elements.sliders.ciechroma, gradientstops);

                elements.sliders.ciechroma_marker.css("left", color.cielch.c / MAXVALIDCHROMA * 100 + "%");
            }

            function renderCieHue()
            {
                var gradientstops = $.fn.ColorPickerSliders.getScaledGradientStops(color.cielch, "h", 0, 360, 28, settings.invalidcolorsopacity);

                gradientstops = extendCieGradientStops(gradientstops, "h");

                $.fn.ColorPickerSliders.setGradient(elements.sliders.ciehue, gradientstops);

                elements.sliders.ciehue_marker.css("left", color.cielch.h / 360 * 100 + "%");
            }

            function renderPreview()
            {
                elements.sliders.preview.css("background", $.fn.ColorPickerSliders.csscolor(color.rgba));
            }

        });

    };

    $.fn.ColorPickerSliders.getScaledGradientStops = function(color, scalableproperty, minvalue, maxvalue, steps, invalidcolorsopacity, minposition, maxposition)
    {
        if (typeof invalidcolorsopacity === "undefined") {
            invalidcolorsopacity = 1;
        }

        if (typeof minposition === "undefined") {
            minposition = 0;
        }

        if (typeof maxposition === "undefined") {
            maxposition = 100;
        }

        var gradientStops = [],
            diff = maxvalue - minvalue,
            isok = true;

        for(var i=0; i<steps; ++i) {
            var currentstage = i / (steps-1),
                modifiedcolor = $.fn.ColorPickerSliders.modifyColor(color, scalableproperty, currentstage * diff + minvalue),
                csscolor;

            if (invalidcolorsopacity < 1) {
                var stagergb = $.fn.ColorPickerSliders.lch2rgb(modifiedcolor, invalidcolorsopacity);

                isok = stagergb.isok;
                csscolor = $.fn.ColorPickerSliders.csscolor(stagergb, invalidcolorsopacity);
            }
            else {
                csscolor = $.fn.ColorPickerSliders.csscolor(modifiedcolor, invalidcolorsopacity);
            }

            gradientStops[i] = {
                color: csscolor,
                position: currentstage * (maxposition-minposition) + minposition,
                isok: isok,
                rawcolor: modifiedcolor
            };
        }

        return gradientStops;
    };

    $.fn.ColorPickerSliders.setGradient = function(element, gradientstops)
    {
        gradientstops.sort(function(a, b) {
            return a.position - b.position;
        });

        var gradientstring = "",
                oldwebkitgradientstring = "",
                noprefix = "linear-gradient(to right",
                webkit = "-webkit-linear-gradient(left",
                oldwebkit = "-webkit-gradient(linear, left top, right top";


        for (var i = 0; i < gradientstops.length; i++) {
            var el = gradientstops[i];

            gradientstring += "," + el.color + " " + el.position + "%";
            oldwebkitgradientstring += ",color-stop(" + el.position + "%," + el.color + ")";
        }

        gradientstring += ")";
        oldwebkitgradientstring += ")";

        oldwebkit += oldwebkitgradientstring;
        webkit += gradientstring;
        noprefix += gradientstring;

        element.css("background", oldwebkit);
        element.css("background", webkit);
        element.css("background", noprefix);
    };

    $.fn.ColorPickerSliders.isGoodRgb = function(rgb)
    {
        // the default acceptable values are out of 0..255 due to
        // rounding errors with yellow and blue colors (258, -1)
        var maxacceptable = 258;
        var minacceptable = -1;

        if (rgb.r>maxacceptable || rgb.g>maxacceptable || rgb.b>maxacceptable || rgb.r<minacceptable || rgb.g<minacceptable || rgb.b<minacceptable) {
            return false;
        }
        else {
            rgb.r = Math.min(255, rgb.r);
            rgb.g = Math.min(255, rgb.g);
            rgb.b = Math.min(255, rgb.b);
            rgb.r = Math.max(0, rgb.r);
            rgb.g = Math.max(0, rgb.g);
            rgb.b = Math.max(0, rgb.b);

            return true;
        }
    };

    $.fn.ColorPickerSliders.rgb2lch = function(rgb)
    {
        var lch = $.fn.ColorPickerSliders.CIELab2CIELCH($.fn.ColorPickerSliders.XYZ2CIELab($.fn.ColorPickerSliders.rgb2XYZ(rgb)));

        if (rgb.hasOwnProperty('a')) {
            lch.a = rgb.a;
        }

        return lch;
    };

    $.fn.ColorPickerSliders.lch2rgb = function(lch, invalidcolorsopacity)
    {
        if (typeof  invalidcolorsopacity === "undefined") {
            invalidcolorsopacity = 1;
        }

        var rgb = $.fn.ColorPickerSliders.XYZ2rgb($.fn.ColorPickerSliders.CIELab2XYZ($.fn.ColorPickerSliders.CIELCH2CIELab(lch)));

        if ($.fn.ColorPickerSliders.isGoodRgb(rgb))
        {
            if (lch.hasOwnProperty('a')) {
                rgb.a = lch.a;
            }

            rgb.isok = true;

            return rgb;
        }

        var tmp = $.extend({}, lch),
            lastbadchroma = tmp.c,
            lastgoodchroma = -1,
            loops = 0;

        do {
            ++loops;

            tmp.c = lastgoodchroma + ((lastbadchroma - lastgoodchroma) / 2);

            rgb = $.fn.ColorPickerSliders.XYZ2rgb($.fn.ColorPickerSliders.CIELab2XYZ($.fn.ColorPickerSliders.CIELCH2CIELab(tmp)));

            if ($.fn.ColorPickerSliders.isGoodRgb(rgb)) {
                lastgoodchroma = tmp.c;
            }
            else {
                lastbadchroma = tmp.c;
            }
        } while(Math.abs(lastbadchroma - lastgoodchroma) > 0.9 && loops < 100);

        if (lch.hasOwnProperty('a')) {
            rgb.a = lch.a;
        }

        rgb.r = Math.max(0, rgb.r);
        rgb.g = Math.max(0, rgb.g);
        rgb.b = Math.max(0, rgb.b);

        rgb.r = Math.min(255, rgb.r);
        rgb.g = Math.min(255, rgb.g);
        rgb.b = Math.min(255, rgb.b);

        if (invalidcolorsopacity < 1) {
            if (rgb.hasOwnProperty('a')) {
                rgb.a = rgb.a * invalidcolorsopacity;
            }
            else {
                rgb.a = invalidcolorsopacity;
            }
        }

        rgb.isok = false;

        return rgb;
    };

    $.fn.ColorPickerSliders.modifyColor = function(color, property, value)
    {
        var modifiedcolor = $.extend({}, color);

        if (!color.hasOwnProperty(property)) {
            throw("Missing color property: " + property);
        }

        modifiedcolor[property] = value;

        return modifiedcolor;
    };

    $.fn.ColorPickerSliders.csscolor = function(color, invalidcolorsopacity)
    {
        if (typeof  invalidcolorsopacity === "undefined") {
            invalidcolorsopacity = 1;
        }

        var $return = false,
            tmpcolor = $.extend({}, color);

        if (tmpcolor.hasOwnProperty('c')) {
            // CIE-LCh
            tmpcolor = $.fn.ColorPickerSliders.lch2rgb(tmpcolor, invalidcolorsopacity);
        }

        if (tmpcolor.hasOwnProperty('h')) {
            // HSL
            $return = "hsla(" + tmpcolor.h + "," + tmpcolor.s * 100 + "%," + tmpcolor.l * 100 + "%," + tmpcolor.a + ")";
        }

        if (tmpcolor.hasOwnProperty('r')) {
            // RGB
            if (tmpcolor.a < 1) {
                $return = "rgba(" + Math.round(tmpcolor.r) + "," + Math.round(tmpcolor.g) + "," + Math.round(tmpcolor.b) + "," + tmpcolor.a + ")";
            }
            else {
                $return = "rgb(" + Math.round(tmpcolor.r) + "," + Math.round(tmpcolor.g) + "," + Math.round(tmpcolor.b) + ")";
            }
        }

        return $return;
    };

    $.fn.ColorPickerSliders.rgb2XYZ = function(rgb)
    {
        var XYZ = {};

        var r = (rgb.r / 255);
        var g = (rgb.g / 255);
        var b = (rgb.b / 255);

        if (r > 0.04045) {
            r = Math.pow(((r + 0.055) / 1.055), 2.4);
        }
        else {
            r = r / 12.92;
        }

        if (g > 0.04045) {
            g = Math.pow(((g + 0.055) / 1.055), 2.4);
        }
        else {
            g = g / 12.92;
        }

        if (b > 0.04045) {
            b = Math.pow(((b + 0.055) / 1.055), 2.4);
        }
        else {
            b = b / 12.92;
        }

        r = r * 100;
        g = g * 100;
        b = b * 100;

        // Observer = 2°, Illuminant = D65
        XYZ.x = r * 0.4124 + g * 0.3576 + b * 0.1805;
        XYZ.y = r * 0.2126 + g * 0.7152 + b * 0.0722;
        XYZ.z = r * 0.0193 + g * 0.1192 + b * 0.9505;

        return XYZ;
    };

    $.fn.ColorPickerSliders.XYZ2CIELab = function(XYZ)
    {
        var CIELab = {};

        // Observer = 2°, Illuminant = D65
        var X = XYZ.x / 95.047;
        var Y = XYZ.y / 100.000;
        var Z = XYZ.z / 108.883;

        if (X > 0.008856) {
            X = Math.pow(X, 0.333333333);
        }
        else {
            X = 7.787 * X + 0.137931034;
        }

        if (Y > 0.008856) {
            Y = Math.pow(Y, 0.333333333);
        }
        else {
            Y = 7.787 * Y + 0.137931034;
        }

        if (Z > 0.008856) {
            Z = Math.pow(Z, 0.333333333);
        }
        else {
            Z = 7.787 * Z + 0.137931034;
        }

        CIELab.l = (116 * Y) - 16;
        CIELab.a = 500 * (X - Y);
        CIELab.b = 200 * (Y - Z);

        return CIELab;
    };

    $.fn.ColorPickerSliders.CIELab2CIELCH = function(CIELab)
    {
        var CIELCH = {};

        CIELCH.l = CIELab.l;
        CIELCH.c = Math.sqrt(Math.pow(CIELab.a, 2) + Math.pow(CIELab.b, 2));

        CIELCH.h = Math.atan2(CIELab.b, CIELab.a);  //Quadrant by signs

        if (CIELCH.h > 0) {
            CIELCH.h = (CIELCH.h / Math.PI) * 180;
        }
        else {
            CIELCH.h = 360 - (Math.abs(CIELCH.h) / Math.PI) * 180;
        }

        return CIELCH;
    };

    $.fn.ColorPickerSliders.CIELCH2CIELab = function(CIELCH)
    {
        var CIELab = {};

        CIELab.l = CIELCH.l;
        CIELab.a = Math.cos(CIELCH.h * 0.01745329251) * CIELCH.c;
        CIELab.b = Math.sin(CIELCH.h * 0.01745329251) * CIELCH.c;

        return CIELab;
    };

    $.fn.ColorPickerSliders.CIELab2XYZ = function(CIELab)
    {
        var XYZ = {};

        XYZ.y = (CIELab.l + 16) / 116;
        XYZ.x = CIELab.a / 500 + XYZ.y;
        XYZ.z = XYZ.y - CIELab.b / 200;

        if (Math.pow(XYZ.y, 3) > 0.008856) {
            XYZ.y = Math.pow(XYZ.y, 3);
        }
        else {
            XYZ.y = (XYZ.y - 0.137931034) / 7.787;
        }

        if (Math.pow(XYZ.x, 3) > 0.008856) {
            XYZ.x = Math.pow(XYZ.x, 3);
        }
        else {
            XYZ.x = (XYZ.x - 0.137931034) / 7.787;
        }

        if (Math.pow(XYZ.z, 3) > 0.008856) {
            XYZ.z = Math.pow(XYZ.z, 3);
        }
        else {
            XYZ.z = (XYZ.z - 0.137931034) / 7.787;
        }

        // Observer = 2°, Illuminant = D65
        XYZ.x = 95.047 * XYZ.x;
        XYZ.y = 100.000 * XYZ.y;
        XYZ.z = 108.883 * XYZ.z;

        return XYZ;
    };

    $.fn.ColorPickerSliders.XYZ2rgb = function(XYZ)
    {
        var rgb = {};

        // Observer = 2°, Illuminant = D65
        XYZ.x = XYZ.x / 100;        // X from 0 to 95.047
        XYZ.y = XYZ.y / 100;        // Y from 0 to 100.000
        XYZ.z = XYZ.z / 100;        // Z from 0 to 108.883

        rgb.r = XYZ.x * 3.2406 + XYZ.y * -1.5372 + XYZ.z * -0.4986;
        rgb.g = XYZ.x * -0.9689 + XYZ.y * 1.8758 + XYZ.z * 0.0415;
        rgb.b = XYZ.x * 0.0557 + XYZ.y * -0.2040 + XYZ.z * 1.0570;

        if (rgb.r > 0.0031308) {
            rgb.r = 1.055 * (Math.pow(rgb.r, 0.41666667)) - 0.055;
        }
        else {
            rgb.r = 12.92 * rgb.r;
        }

        if (rgb.g > 0.0031308) {
            rgb.g = 1.055 * (Math.pow(rgb.g, 0.41666667)) - 0.055;
        }
        else {
            rgb.g = 12.92 * rgb.g;
        }

        if (rgb.b > 0.0031308) {
            rgb.b = 1.055 * (Math.pow(rgb.b, 0.41666667)) - 0.055;
        }
        else {
            rgb.b = 12.92 * rgb.b;
        }

        rgb.r = Math.round(rgb.r * 255);
        rgb.g = Math.round(rgb.g * 255);
        rgb.b = Math.round(rgb.b * 255);

        return rgb;
    };

})(jQuery);
