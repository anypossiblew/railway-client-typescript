import tough = require('tough-cookie');
export declare class FileCookieStore extends tough.MemoryCookieStore {
    idx: object;
    filePath: string;
    constructor(filePath: string, option: {
        encrypt: boolean;
        algorithm: string;
        password: string;
    });
    putCookie(cookie: tough.Cookie, cb: object): void;
    removeCookie(domain: any, path: any, key: any, cb: any): void;
    removeCookies(domain: any, path: any, cb: any): void;
    getCookie(domain: any, path: any, key: any): any;
    flush(): void;
    isEmpty(): boolean;
    private isEmptyObject(obj);
    private saveToFile(filePath, data, option, cb);
    private loadFromFile(filePath, option, cb);
}
