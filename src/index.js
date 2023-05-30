import { XMLParser } from "fast-xml-parser";
import fetch from "node-fetch";

const COMPANY_ID_LENGTH = 8;
const ARES_API_URL = "https://wwwinfo.mfcr.cz/cgi-bin/ares/darv_bas.cgi";
export default function getAresData(companyId) {
    return new Promise(async (resolve, reject) => {
        if (!validate_czech_company_id(companyId)) {
            reject("Invalid company ID");
        }
        const params = { ico: companyId };

        try {
            const response = await fetch(
                ARES_API_URL + "?" + new URLSearchParams(params)
            );
            if (response.status !== 200) {
                throw new Error(
                    `Ares API returned status code ${response.status}`
                );
            }
            const ares_data = await response.text();
            const parser = new XMLParser();
            const response_root_wrapper =
                parser.parse(ares_data)["are:Ares_odpovedi"];
            const ares_fault = response_root_wrapper["are:Fault"];
            if (ares_fault) {
                return reject("Ares API returned error: " + ares_fault)
            }
            const response_root = response_root_wrapper["are:Odpoved"];
            const number_of_results = response_root["D:PZA"];
            if (parseInt(number_of_results) === 0) {
                return resolve(null);
            }
            const company_record = response_root["D:VBAS"];
            const address = company_record["D:AA"];
            const full_text_address = address["D:AT"] || "";
            const result_company_info = {
                legal: {
                    company_name: company_record["D:OF"],
                    company_id: company_record["D:ICO"],
                    company_vat_id: company_record["D:DIC"],
                    legal_form: get_legal_form(company_record["D:PF"]),
                },
                address: {
                    region: address["D:NOK"],
                    city: build_city(address["D:N"], full_text_address),
                    city_part: address["D:NCO"],
                    city_town_part: address["D:NMC"],
                    street: build_czech_street(
                        address["D:NU"] || "",
                        address["D:N"],
                        address["D:NCO"],
                        address["D:CD"] || address["D:CA"],
                        address["D:CO"],
                        full_text_address
                    ),
                    zip_code: get_czech_zip_code(
                        address["D:PSC"],
                        full_text_address
                    ),
                },
            };
            return resolve(result_company_info);
        } catch (error) {
            // TODO: Handle this error
            reject(error);
        }
    });
}

function get_czech_zip_code(ares_data, full_text_address) {
    if (ares_data && /^\d+$/.test(ares_data)) {
        return ares_data;
    }
    const zip_code_regex = /PS[CČ]?\s+(?<zip_code>\d+)/i;
    const search = full_text_address.match(zip_code_regex);
    if (search) {
        return search.groups.zip_code;
    } else {
        console.warn(
            `Cannot retrieve ZIP_CODE from this: "${full_text_address}" address`
        );
        return "";
    }
}

function build_czech_street(
    street_name,
    city_name,
    neighborhood,
    house_number,
    orientation_number,
    full_text_address
) {
    street_name = street_name || neighborhood || city_name;
    if (!street_name && !house_number) {
        return guess_czech_street_from_full_text_address(full_text_address);
    }
    if (!orientation_number) {
        return `${street_name}${house_number ? ` ${house_number}` : ""}`;
    }
    return `${street_name} ${house_number}/${orientation_number}`;
}

function guess_czech_street_from_full_text_address(full_text_address) {
    const address_parts = full_text_address.split(",");
    if (address_parts.length < 3) {
        return address_parts[address_parts.length - 1];
    } else if (address_parts.length === 3) {
        return address_parts[1];
    } else {
        console.warn(`Cannot parse this: "${full_text_address}" address`);
        return "";
    }
}

function build_city(city, address) {
    return city || address.split(",")[0];
}

function get_legal_form(legal_form) {
    return legal_form ? legal_form["D:KPF"] : null;
}

function validate_czech_company_id(business_id) {
    business_id = `${business_id}`;
    const digits = Array.from(business_id.padStart(COMPANY_ID_LENGTH, "0")).map(
        Number
    );
    const remainder =
        digits
            .slice(0, 7)
            .reduce(
                (acc, digit, index) =>
                    acc + digit * (COMPANY_ID_LENGTH - index),
                0
            ) % 11;
    const cksum = { 0: 1, 10: 1, 1: 0 }[remainder] || 11 - remainder;
    if (digits[7] !== cksum) {
        return false;
    }
    return true;
}
