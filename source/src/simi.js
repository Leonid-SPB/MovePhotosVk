/** See original code at GIT Hub: bitlyfied/js-image-similarity/simi.js */

var ImgPercHash = (function () {
  var SIMILARITY_THRESHOLD = 0.13;
  var HASH_UNIT = 32; //bits

  // Returns an array with averaged colors (shades of gray)
  // @param data
  function desaturate(data) {
    var grays = new Array(data.length / 4);
    for (var i = 0; i < grays.length; i++) {
      var j = i * 4;
      grays[i] = Math.round((data[j] + data[j + 1] + data[j + 2]) / 3);
    }
    return grays;
  }

  // Returns the average of an array of numbers
  // @param data
  // @return Number
  function average(data) {
    var total = 0;
    for (var i = 0; i < data.length; i++) {
      total += data[i];
    }
    return Math.round(total / data.length);
  }

  function hammingDistance(bitsA, bitsB) {
    var diffMask = (bitsA ^ bitsB).toString(2);
    return (diffMask.match(/1/g) || []).length;
  }

  function decimalToHex(d, padding) {
    var hex = Number(d).toString(16);
    padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

    while (hex.length < padding) {
      hex = "0" + hex;
    }

    return hex;
  }

  // Scale down the image to the specified width ad height and returns
  // an array of the resulting pixels
  //
  // @param image
  // @param width
  // @param height
  // @return CanvasPixelArray
  function pixelsMap(image, width, height) {
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    var context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);

    return context.getImageData(0, 0, width, height).data;
  }

  var ImgPercHash = function (imgSizeWH) {
    this.IMG_SIZE_WH = imgSizeWH;
    this.IMG_AREA = imgSizeWH * imgSizeWH;

    if (this.IMG_AREA % HASH_UNIT) {
      throw "ImgPercHash::Invalid image size, area must be multiple of HASH_UNIT";
    }

    this.hash = function (image) {
      var pixMap = pixelsMap(image, this.IMG_SIZE_WH, this.IMG_SIZE_WH),
        bytesMap = desaturate(pixMap),
        avg = average(bytesMap),
        thresholdMap = this.thresholdMap(bytesMap, avg);

      return thresholdMap;
    };

    this.compare = function (first, second) {
      first = (first instanceof HTMLImageElement) ? this.hash(first) : first;
      second = (second instanceof HTMLImageElement) ? this.hash(second) : second;

      var distance = this.hammingDistanceHex(first, second);

      return (distance / this.IMG_AREA).toFixed(3);
    };

    this.same = function (first, second) {
      return this.compare(first, second) <= this.SIMILARITY_THRESHOLD;
    };

    // Generates a long bitmask from an array of bytes.
    // Each byte is converted in a positive bit if the byte is greater
    // or equal than the specified threshold
    //
    // @param data
    // @param threshold
    // @return Number bitmap
    this.thresholdMap = function (data, threshold) {
      return this.mapToBits(data, function (byteData) {
        return byteData >= threshold;
      });
    };

    // Generates a bit mask by invoking the callback on each element
    // of the provided array and computing the result as a series of bit.
    // The callback must return a boolean.
    //
    // @param data
    // @param callback
    // @return Number bitMask
    this.mapToBits = function (data, callback) {
      var result = "";

      for (var i = 0; i < this.IMG_AREA / HASH_UNIT; ++i) {
        var bit = 1;
        var num = 0;
        for (var j = 0; j < HASH_UNIT; ++j) {
          num += callback(data[i * HASH_UNIT + j]) * bit;
          bit *= 2;
        }
        result += decimalToHex(num, HASH_UNIT/4);
      }
      return result;
    };

    // Returning the Hamming distance between two series of bits encoded in a hexadecimal strings
    //
    // @param hexStrA
    // @param hexStrB
    // @return Number distance
    this.hammingDistanceHex = function (hexStrA, hexStrB) {
      var dist = 0;
      for (var i = 0; i < hexStrA.length / HASH_UNIT; ++i) {
        dist += hammingDistance(parseInt(hexStrA.substr(i * HASH_UNIT, HASH_UNIT), 16), parseInt(hexStrB.substr(i * HASH_UNIT, HASH_UNIT), 16));
      }
      return dist;
    };

  };

  return ImgPercHash;
})();
