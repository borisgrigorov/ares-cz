# Ares
Simple JSON API for the accessing the Ares database of the Czech Ministry of Finance.

## Installation
```bash
npm i ares
```

## Usage
```javascript
import ares from 'ares';
const ico = '26185610';

ares(ico).then((data) => {
  console.log(data);
});
```
