https://kyfw.12306.cn/otn/resources/js/framework/station_name.js

var Z = station_names.split("@");
for (var Y = 0; Y < Z.length; Y++) {
    var ab = Z[Y];
    var aa = ab.toString().charAt(0);
    for (var X in F) {
        if (aa == F[X]) {
            c[X].push(ab.split("|"))
        }
    }
    if (ab.length > 0) {
        ab = ab.split("|");
        if (O != "" && ab[2] == O) {
            favcity = ab;
            w.unshift(ab);
            if (Y > 6) {
                w.push(ab)
            }
        } else {
            w.push(ab)
        }
    }
}
f = c[0].concat(c[1]).concat(c[2]).concat(c[3]).concat(c[4]);
e = c[5].concat(c[6]).concat(c[7]).concat(c[8]).concat(c[9]);
d = c[10].concat(c[11]).concat(c[12]).concat(c[13]).concat(c[14]);
b = c[15].concat(c[16]).concat(c[17]).concat(c[18]).concat(c[19]);
V = c[20].concat(c[21]).concat(c[22]).concat(c[23]).concat(c[24]).concat(c[25]);
P[0] = [c[0], c[1], c[2], c[3], c[4]];
P[1] = [c[5], c[6], c[7], c[8], c[9]];
P[2] = [c[10], c[11], c[12], c[13], c[14]];
P[3] = [c[15], c[16], c[17], c[18], c[19]];
P[4] = [c[20], c[22], c[23], c[24], c[25]];
for (var Y = 0; Y < w.length; Y++) {
    w[Y].push(Y)
}
