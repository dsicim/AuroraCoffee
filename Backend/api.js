const body = await new Promise((resolve, reject) => {
            let t = 0;
            let b = "";
            req.on("data", function (c) {
                b += c;
            });
            req.on("end", function () {
                if (b == "") {
                    t = 0;
                    b = null;
                }
                else {
                    try {
                        b = JSON.parse(b);
                        t = 2;
                    } catch (error) {
                        t = 1;
                    }
                }
                resolve({ exists: t !== 0, json: t === 2, data: b, err: null });
            });
            req.on("error", function (err) {
                resolve({ exists: false, json: false, data: null, err: err });
            });
        });