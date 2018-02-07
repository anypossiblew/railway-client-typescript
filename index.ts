
import {Account} from './src/Account';

new Account("xxxxxxxx", "xxxxxxxxxxxxxxxx")
  .createOrder("2018-02-28",
               "2018-02-28",
               ["G150", "G152", "G216", "G24", "G1940", "G44", "G298", "G1826", "G7600", "G7176", "G7590", "G368", "G7178", "G7300"],
               ["王体文"])
  .submit();
