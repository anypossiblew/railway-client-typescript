import tough = require('tough-cookie');
export interface Option {
    encrypt: boolean;
    algorithm?: string;
    password?: string;
}
export interface Callback {
    (param?: any | void): any | void;
}
export declare class FileCookieStore extends tough.MemoryCookieStore {
    private idx;
    private filePath;
    private option;
    constructor(filePath: string, option: Option);
    putCookie(cookie: tough.Cookie, cb?: Callback): void;
    removeCookie(domain: string, path: string, key: string, cb?: Callback): void;
    removeCookies(domain: string, path: string, cb?: Callback): void;
    getCookie(domain: string, path: string, key: string): any;
    flush(): void;
    isEmpty(): boolean;
    private isEmptyObject(obj);
    private saveToFile(filePath, data, option, cb?);
    private loadFromFile(filePath, option, cb);
}
