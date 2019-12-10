import * as React from "react";
import { FormFields } from "./FormFields";
import { FormCheck } from "react-bootstrap";

interface CheckboxProps {
    label: string;
    formData: FormFields;
    field: string;
    onChange: (formData: FormFields) => void;
}

export const Checkbox: React.FC<CheckboxProps> = props => {

    return (
        <div className="form-check">
            <input checked={props.formData[props.field] === "true"} type="checkbox" className="form-check-input" onChange={e => {
                const newValue = {...props.formData};
                newValue[props.field] = e.target.checked ? "true" : "false";
                props.onChange(newValue);
            }}/>
            <label className="form-check-label">{props.label}</label>
        </div>
    );
};

// <div class="form-check"><input type="checkbox" class="form-check-input"><label title="" type="checkbox" class="form-check-label">Large Brushes</label></div>
