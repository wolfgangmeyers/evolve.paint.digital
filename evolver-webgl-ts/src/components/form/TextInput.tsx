import * as React from "react";
import { FormFields } from "./FormFields";

interface TextInputProps {
    formData: FormFields;
    field: string;
    onChange: (formData: FormFields) => void;
}

export const TextInput: React.FC<TextInputProps> = props => {
    return <input type="text" value={props.formData[props.field]} className="form-control" onChange={e => {
        const newValue = {...props.formData};
        newValue[props.field] = e.target.value;
        props.onChange(newValue);
    }} />
}
